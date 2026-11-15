/**
 * Blueprint space (the spec's section 1): the world behind every page. One WebGL2 canvas, no library: a slow field of
 * the brand's blue and gold light, an endless drafting grid floor with + marks fading into depth, and a slow beam. The
 * scroll flies the camera over the floor (rising, tipping down, turning) towards the page's own drawing (the F450, the
 * mini drone, the network, the badge: public/look/drawings/, made by scripts/build-floor-drawings.py), which a pen
 * drafts as you scroll; glass cards with the real parts (public/look/parts-atlas.webp) float over it. The pointer leans
 * it all.
 *
 * Kept cheap and out of the way:
 * - the decisions are src/lib/look/field.ts (tested): the frame meter steps resolution down when frames run slow and
 *   back up when they don't, judged against the screen's own rate; after three slow seconds at half resolution, or
 *   anywhere under 25 fps, it gives up for the still picture (kept on the persisted .site-bg, so it survives page
 *   changes);
 * - it draws only while the tab is visible, motion is allowed and the page shows no full-window 3D of its own (the
 *   studio, or anything marked [data-own-backdrop]); idle (no scroll or pointer for a second) it drops to 30 fps;
 * - the grid stays faint in the middle of the screen, where text is, and only shows itself towards the edges.
 * The canvas is persisted across page changes (BaseLayout). window.__field reports its state for the page checks.
 */
import { dayAt, revealAt, tileLayout, type Parts } from "@/lib/look/drawing";
import { cameraFor, newMeter, resetMeter, shouldAnimate, tickMeter } from "@/lib/look/field";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uNight;   // 1 dark theme, 0 light (eased)
uniform vec4 uCam;      // height, pitch, drift, yaw
uniform vec2 uLean;
uniform sampler2D uDraw; // the floor drawing: rgb its draw order, a its line (premultiplied)
uniform vec3 uDrawAt;   // where it lies (x, z) and which way it faces (the camera's final yaw)
uniform float uReveal;  // how much of it the pen has drawn

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// A grid line's coverage at p, one pixel wide whatever the distance.
float line(vec2 p, float width) {
	vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
	return 1.0 - clamp(min(g.x, g.y) / width, 0.0, 1.0);
}
// A + mark at every fourth crossing.
float plus(vec2 p) {
	vec2 c = abs(fract(p / 4.0 + 0.5) - 0.5) * 4.0;
	vec2 w = fwidth(p) * 1.4;
	float arm = 0.22;
	float h = step(c.y, w.y) * step(c.x, arm);
	float v = step(c.x, w.x) * step(c.y, arm);
	return max(h, v);
}

void main() {
	vec2 uv = vUv * vec2(uRes.x / uRes.y, 1.0);

	// Colours: the brand's own (spec section 4).
	vec3 nightField = vec3(0.039, 0.090, 0.306);   // #0A174E
	vec3 nightDeep = vec3(0.020, 0.047, 0.180);
	vec3 nightGold = vec3(0.961, 0.816, 0.259);    // #F5D042
	vec3 nightBlue = vec3(0.184, 0.486, 0.902);    // #2F7CE6
	vec3 dayField = vec3(0.949, 0.933, 0.875);     // #F2EEDF
	vec3 dayBlue = vec3(0.780, 0.855, 0.965);
	vec3 dayGold = vec3(0.984, 0.890, 0.620);
	vec3 field = mix(dayField, nightField, uNight);
	vec3 deep = mix(dayField * 0.985, nightDeep, uNight);
	vec3 gold = mix(dayGold, nightGold, uNight);
	vec3 blue = mix(dayBlue, nightBlue, uNight);
	vec3 ink = mix(vec3(0.039, 0.090, 0.306), vec3(0.949, 0.933, 0.875), uNight);

	// The field: deeper at the top, a slow light drifting through it, gold low, blue high. Kept close to --field so
	// text straight on the page keeps its contrast.
	float t = uTime * 0.02;
	float n = noise(uv * 1.3 + vec2(t, -t * 0.6)) * 0.6 + noise(uv * 2.7 - vec2(t * 0.8, t)) * 0.4;
	vec3 col = mix(field, deep, smoothstep(-0.2, 1.1, vUv.y) * 0.7);
	col = mix(col, blue, (0.10 + 0.08 * n) * smoothstep(-0.1, 1.0, vUv.y + uLean.y) * mix(0.5, 1.0, uNight));
	col = mix(col, gold, (0.07 + 0.06 * n) * smoothstep(0.6, -1.0, vUv.y) * smoothstep(1.6, 0.0, abs(uv.x - 0.6 + uLean.x * 4.0)));

	// The beam: a soft diagonal band of light, sweeping very slowly.
	float beam = exp(-pow((uv.x * 0.8 + uv.y * 0.55 - 0.35 + sin(uTime * 0.05) * 0.25) * 2.2, 2.0));
	col += mix(blue, gold, 0.35) * beam * mix(0.035, 0.07, uNight);

	// The floor: a ray from the camera onto the plane y = 0.
	float pitch = uCam.y + uLean.y;
	vec3 dir = normalize(vec3(uv.x + uLean.x, uv.y * cos(pitch) - sin(pitch), -(uv.y * sin(pitch) + cos(pitch))));
	float cy = cos(uCam.w), sy = sin(uCam.w);
	dir.xz = vec2(dir.x * cy - dir.z * sy, dir.x * sy + dir.z * cy);
	if (dir.y < -0.002) {
		float dist = uCam.x / -dir.y;
		vec2 p = vec2(dir.x, dir.z) * dist + vec2(0.0, -uCam.z);
		float fade = exp(-dist * 0.045) * smoothstep(0.0, 0.08, -dir.y);
		// Faint in the middle of the screen (where text is), clearer towards the edges.
		float edge = mix(0.3, 1.0, smoothstep(0.2, 0.9, length(vUv * vec2(0.9, 1.0))));
		float g = line(p, 1.0) * 0.55 + plus(p) * 0.9;
		col = mix(col, ink, g * fade * edge * mix(0.17, 0.24, uNight));
		col = mix(col, blue, line(p / 8.0, 1.2) * fade * edge * 0.16);

		// The drawing, 20 m square where the flight ends, drafted by the scroll: faint construction lines first, then
		// ink where the pen has been, the freshest ink glowing like a pen tip.
		vec2 q = p - uDrawAt.xy;
		float ce = cos(uDrawAt.z), se = sin(uDrawAt.z);
		vec2 duv = vec2(dot(q, vec2(ce, se)), dot(q, vec2(-se, ce))) / 20.0 + 0.5;
		if (all(greaterThan(duv, vec2(0.0))) && all(lessThan(duv, vec2(1.0)))) {
			vec4 d = texture(uDraw, duv);
			if (d.a > 0.004) {
				float order = (d.r * 0.99610 + d.g * 0.003891) / d.a;
				float drawn = smoothstep(uReveal + 0.002, uReveal - 0.002, order);
				float fresh = exp(-max(uReveal - order, 0.0) * 70.0) * drawn * step(0.001, uReveal);
				vec3 accent = mix(vec3(0.184, 0.486, 0.902), vec3(0.961, 0.816, 0.259), uNight);
				// Faint where text sits (the middle of the screen), full strength towards the edges.
				float near = exp(-dist * 0.009) * mix(0.28, 1.0, smoothstep(0.15, 0.85, length(vUv * vec2(0.9, 1.0))));
				col = mix(col, ink, d.a * (1.0 - drawn) * 0.14 * near);
				col = mix(col, accent, min(0.75, d.a * drawn * (0.7 + 0.3 * fresh) * near * 1.5));
				col = mix(col, mix(accent, vec3(1.0), 0.5 * uNight), d.a * fresh * (0.75 + 0.25 * sin(uTime * 4.0)) * near);
			}
		}
	}
	outColor = vec4(col, 1.0);
}`;

// The glass tiles: one instanced quad per card, a real part's picture (from the atlas) behind frosted glass.
const TILE_VERT = `#version 300 es
in vec2 aCorner;
in vec4 aTile;   // x, y, depth (1 near .. 3 far), half-size
in vec2 aMore;   // spin, atlas cell
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform vec2 uLean;
out vec2 vLocal;
out vec2 vAtlas;
out float vLight;
out float vDepth;
out float vEdge;
void main() {
	float depth = (aTile.z - 1.0) / 2.0;
	vec2 c = aTile.xy;
	// Up with the scroll (nearer cards faster), round again off-screen; a slow bob; parallax against the lean.
	c.y = mod(c.y + uScroll * (1.2 + 1.4 * (1.0 - depth)) + 1.4, 2.8) - 1.4;
	c.y += sin(uTime * 0.4 + aTile.x * 5.0) * 0.02;
	c -= uLean * (2.0 - depth) * 2.0;
	float size = aTile.w * mix(1.15, 0.8, depth);
	float s = aMore.x * 0.35 + sin(uTime * 0.25 + aTile.y * 4.0) * 0.04;
	vec3 p = vec3(mat2(cos(s), sin(s), -sin(s), cos(s)) * (aCorner * size), 0.0);
	// Turned a little towards the pointer, with a touch of perspective.
	float ry = uLean.x * 9.0 + aMore.x * 0.5, rx = -uLean.y * 9.0;
	p = vec3(p.x * cos(ry) + p.z * sin(ry), p.y, -p.x * sin(ry) + p.z * cos(ry));
	p = vec3(p.x, p.y * cos(rx) - p.z * sin(rx), p.y * sin(rx) + p.z * cos(rx));
	p.xy /= 1.0 - p.z * 1.2;
	vec2 pos = c + p.xy;
	gl_Position = vec4(pos.x * uRes.y / uRes.x, pos.y, 0.0, 1.0);
	// Where the page's content column is (about the middle 80%), a card is only a ghost; in the margins, full.
	vEdge = mix(0.22, 1.0, smoothstep(0.6, 0.86, abs(gl_Position.x)));
	vLocal = aCorner;
	vAtlas = (vec2(mod(aMore.y, 4.0), floor(aMore.y / 4.0)) + 0.5 + aCorner * vec2(0.46, -0.46)) / 4.0;
	vLight = 0.5 + 0.5 * sin(ry - rx + 0.6);
	vDepth = depth;
}`;

const TILE_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vAtlas;
in float vLight;
in float vDepth;
in float vEdge;
uniform sampler2D uAtlas;
uniform float uNight;
out vec4 outColor;
void main() {
	vec2 q = abs(vLocal) - 0.84;
	float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.16;
	float aa = fwidth(d);
	float inside = 1.0 - smoothstep(-aa, aa, d);
	if (inside <= 0.0) discard;
	// Frosted glass with the part behind it (premultiplied); a far card is a little out of focus.
	vec3 glass = mix(vec3(1.0), vec3(0.075, 0.137, 0.373), uNight);
	float glassA = mix(0.42, 0.34, uNight);
	vec4 img = texture(uAtlas, vAtlas, vDepth * 2.0);
	vec3 col = img.rgb * mix(1.0, 0.85, vDepth) + glass * glassA * (1.0 - img.a);
	float a = img.a + glassA * (1.0 - img.a);
	// The rim: a thin bright edge, brighter on the side the card turns to the light.
	float rimA = (1.0 - smoothstep(0.0, aa * 2.5 + 0.02, -d)) * (0.35 + 0.5 * vLight);
	vec3 rim = mix(vec3(0.184, 0.486, 0.902), vec3(1.0, 0.97, 0.88), uNight);
	col = col * (1.0 - rimA) + rim * rimA;
	a = a * (1.0 - rimA) + rimA;
	outColor = vec4(col, a) * inside * mix(0.95, 0.5, vDepth) * vEdge;
}`;

declare global {
	interface Window {
		__field?: { paused: boolean; scale: number; night: number; frames: number; fallback: boolean; reveal: number; drawing: string; tiles: number };
	}
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
	return shader;
}

function link(gl: WebGL2RenderingContext, vert: string, frag: string) {
	const program = gl.createProgram()!;
	gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vert));
	gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
	return program;
}

/** A texture from a picture: premultiplied, no colour conversion (the drawings' colours are numbers), mipmapped. */
async function loadTexture(gl: WebGL2RenderingContext, url: string, colour: boolean) {
	const blob = await (await fetch(url)).blob();
	const bitmap = await createImageBitmap(blob, { premultiplyAlpha: "premultiply", colorSpaceConversion: colour ? "default" : "none" });
	const texture = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	bitmap.close();
	return texture;
}

const CELLS: Record<Parts, number[]> = {
	all: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
	drone: [0, 1, 2, 3, 4],
	robot: [5, 6, 7, 8, 9, 10, 11, 12, 13],
	none: [],
};
const TILE_COUNT = 7;

function start(canvas: HTMLCanvasElement) {
	const state = (window.__field = { paused: true, scale: 1, night: 1, frames: 0, fallback: false, reveal: 0, drawing: "", tiles: 0 });
	const root = document.documentElement;
	const holder = canvas.closest<HTMLElement>(".site-bg");
	const giveUp = () => {
		state.fallback = true;
		state.paused = true;
		canvas.hidden = true;
		holder?.setAttribute("data-still", "");
	};
	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance" });
	if (!gl) return giveUp();
	let program: WebGLProgram, tileProgram: WebGLProgram;
	try {
		program = link(gl, VERT, FRAG);
		tileProgram = link(gl, TILE_VERT, TILE_FRAG);
	} catch (error) {
		console.warn("Blueprint space: falling back to the still picture.", error);
		return giveUp();
	}
	// The field: one triangle over the screen.
	const fieldVao = gl.createVertexArray();
	gl.bindVertexArray(fieldVao);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(program, "aPos");
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
	const u = (name: string) => gl.getUniformLocation(program, name);
	const uRes = u("uRes"), uTime = u("uTime"), uNight = u("uNight"), uCam = u("uCam"), uLean = u("uLean");
	const uReveal = u("uReveal");
	gl.useProgram(program);
	gl.uniform1i(u("uDraw"), 0);
	// The drawing lies where the flight ends, square to the final view (cameraFor at the end of the page).
	const end = cameraFor(1, { x: 0, y: 0 });
	const ahead = end.height / Math.tan(end.pitch);
	gl.uniform3f(u("uDrawAt"), ahead * Math.sin(end.yaw), -ahead * Math.cos(end.yaw) - end.drift, end.yaw);

	// The tiles: a quad's four corners, and per card x, y, depth, half-size, spin, atlas cell.
	const tileVao = gl.createVertexArray();
	gl.bindVertexArray(tileVao);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	const aCorner = gl.getAttribLocation(tileProgram, "aCorner");
	gl.enableVertexAttribArray(aCorner);
	gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);
	const tileBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
	for (const [name, size, offset] of [["aTile", 4, 0], ["aMore", 2, 16]] as const) {
		const at = gl.getAttribLocation(tileProgram, name);
		gl.enableVertexAttribArray(at);
		gl.vertexAttribPointer(at, size, gl.FLOAT, false, 24, offset);
		gl.vertexAttribDivisor(at, 1);
	}
	gl.bindVertexArray(null);
	const t = (name: string) => gl.getUniformLocation(tileProgram, name);
	const tRes = t("uRes"), tTime = t("uTime"), tScroll = t("uScroll"), tLean = t("uLean"), tNight = t("uNight");
	gl.useProgram(tileProgram);
	gl.uniform1i(t("uAtlas"), 1);

	// Textures: until a picture arrives, an empty one (no lines, never a black square).
	const empty = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, empty);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
	const drawings = new Map<string, WebGLTexture | null>();
	let atlas: WebGLTexture | null = null;
	let tileCount = 0;
	const failed = (error: unknown) => console.warn("Blueprint space: a picture did not load.", error);
	loadTexture(gl, "/look/parts-atlas.webp", true).then((texture) => (atlas = texture), failed);
	// The page's subject (BaseLayout marks <main>): its drawing, and the parts that float over it.
	const choosePage = () => {
		const main = document.querySelector<HTMLElement>("[data-field-drawing]");
		const name = main?.dataset.fieldDrawing ?? "badge";
		if (name !== state.drawing) {
			state.drawing = name;
			if (!drawings.has(name)) {
				drawings.set(name, null);
				loadTexture(gl, `/look/drawings/${name}.png`, false).then((texture) => drawings.set(name, texture), failed);
			}
		}
		const cells = CELLS[(main?.dataset.fieldParts as Parts) ?? "all"] ?? CELLS.all;
		let seed = 7;
		for (const ch of location.pathname) seed = ((seed * 31 + ch.charCodeAt(0)) % 2147483646) + 1;
		const tiles = cells.length ? tileLayout(TILE_COUNT, seed) : [];
		const data = new Float32Array(tiles.length * 6);
		tiles.forEach((tile, i) => data.set([tile.x, tile.y, tile.z, tile.size, tile.spin, cells[(i + seed) % cells.length]], i * 6));
		gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		tileCount = tiles.length;
	};
	// Sections that turn the world to day ([data-field="day"]), looked up on wake.
	let daySections: HTMLElement[] = [];

	const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
	const findOwnBackdrop = () => !!document.querySelector("[data-studio]:not([data-read]), [data-own-backdrop]");
	let ownBackdrop = findOwnBackdrop(); // looked up on wake and when the page's markers change, not every frame
	const pointer = { x: 0, y: 0 };
	const eased = { x: 0, y: 0, scroll: 0 };
	let lastInput = performance.now();
	let night = root.classList.contains("dark") ? 1 : 0;
	let raf = 0;
	let last = 0; // the last frame drawn (for the idle 30 fps step)
	let publishedNight = -1;
	const meter = newMeter();

	const resize = () => {
		const ratio = Math.min(window.devicePixelRatio || 1, 1.5) * state.scale;
		const w = Math.max(1, Math.round(innerWidth * ratio));
		const h = Math.max(1, Math.round(innerHeight * ratio));
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);
		}
	};

	const frame = (now: number) => {
		raf = 0;
		if (!running()) {
			state.paused = true;
			return;
		}
		const idle = now - lastInput > 1000;
		// Idle: 30 frames a second is plenty for a slow drift.
		if (idle && now - last < 31) {
			raf = requestAnimationFrame(frame);
			return;
		}
		last = now;
		const verdict = tickMeter(meter, now, !idle);
		if (verdict === "fallback") return giveUp();
		if (verdict === "rescale") {
			state.scale = meter.scale;
			resize();
		}
		const day =
			daySections.length > 0 &&
			dayAt(
				daySections.map((el) => {
					const r = el.getBoundingClientRect();
					return { top: r.top, bottom: r.bottom, day: true };
				}),
				innerHeight / 2,
			);
		const target = root.classList.contains("dark") && !day ? 1 : 0;
		night += (target - night) * 0.08;
		state.night = night;
		// For later phases' CSS: how far the field is towards night (1) or day (0).
		if (Math.abs(night - publishedNight) > 0.01) {
			publishedNight = night;
			root.style.setProperty("--field-night", night.toFixed(2));
		}
		const max = document.documentElement.scrollHeight - innerHeight;
		eased.scroll += ((max > 0 ? scrollY / max : 0) - eased.scroll) * 0.12;
		eased.x += (pointer.x - eased.x) * 0.06;
		eased.y += (pointer.y - eased.y) * 0.06;
		const cam = cameraFor(eased.scroll, eased);
		state.reveal = revealAt(eased.scroll);
		gl.useProgram(program);
		gl.bindVertexArray(fieldVao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, drawings.get(state.drawing) ?? empty);
		gl.uniform2f(uRes, canvas.width, canvas.height);
		gl.uniform1f(uTime, now / 1000);
		gl.uniform1f(uNight, night);
		gl.uniform4f(uCam, cam.height, cam.pitch, cam.drift, cam.yaw);
		gl.uniform2f(uLean, cam.lean[0], cam.lean[1]);
		gl.uniform1f(uReveal, state.reveal);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		// The glass tiles, over the field; none on a narrow screen, where the text takes the whole width.
		state.tiles = atlas && canvas.width > canvas.height * 1.1 ? tileCount : 0;
		if (state.tiles) {
			gl.useProgram(tileProgram);
			gl.bindVertexArray(tileVao);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, atlas);
			gl.uniform2f(tRes, canvas.width, canvas.height);
			gl.uniform1f(tTime, now / 1000);
			gl.uniform1f(tScroll, eased.scroll);
			gl.uniform2f(tLean, cam.lean[0], cam.lean[1]);
			gl.uniform1f(tNight, night);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, state.tiles);
			gl.disable(gl.BLEND);
		}
		state.frames++;
		raf = requestAnimationFrame(frame);
	};

	const running = () =>
		!state.fallback && shouldAnimate({ hidden: document.hidden, reduced: reducedQuery.matches || root.classList.contains("reduce-motion"), ownBackdrop });

	const wake = () => {
		ownBackdrop = findOwnBackdrop();
		choosePage();
		daySections = [...document.querySelectorAll<HTMLElement>('[data-field="day"]')];
		publishedNight = -1; // <html>'s inline style may have been replaced by a page change
		state.paused = !running();
		canvas.hidden = state.fallback || reducedQuery.matches;
		if (!state.paused && !raf) {
			// The first frame after waking starts the clock (resetMeter); it is never itself measured.
			resetMeter(meter);
			last = 0;
			resize();
			raf = requestAnimationFrame(frame);
		}
	};
	const input = () => {
		lastInput = performance.now();
		if (!raf) wake();
	};

	addEventListener("resize", () => {
		resize();
		input();
	});
	addEventListener("scroll", input, { passive: true });
	addEventListener(
		"pointermove",
		(event) => {
			pointer.x = (event.clientX / innerWidth) * 2 - 1;
			pointer.y = (event.clientY / innerHeight) * 2 - 1;
			input();
		},
		{ passive: true },
	);
	document.addEventListener("visibilitychange", wake);
	reducedQuery.addEventListener("change", wake);
	document.addEventListener("astro:after-swap", wake);
	new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ["class"] });
	// The studio switches to 3D (drops data-read) after load; a page may mark its own full-window 3D. Watched from <html>
	// down: <body> is replaced on every page change, so an observer on it would go deaf after the first one.
	new MutationObserver(wake).observe(root, { subtree: true, attributes: true, attributeFilter: ["data-read", "data-own-backdrop"] });
	canvas.addEventListener("webglcontextlost", (event) => {
		event.preventDefault();
		giveUp();
	});
	wake();
}

const canvas = document.querySelector<HTMLCanvasElement>("[data-blueprint]");
if (canvas && !window.__field) start(canvas);
