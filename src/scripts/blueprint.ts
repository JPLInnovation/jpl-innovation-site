/**
 * Blueprint space (the spec's section 1): the world behind every page. One WebGL2 canvas, one full-screen shader, no
 * library and no textures: a slow field of the brand's blue and gold light, an endless drafting grid floor with + marks
 * fading into depth, and a slow beam. The scroll carries the camera forward over the floor; the pointer leans it.
 *
 * Kept cheap and out of the way:
 * - the decisions are src/lib/look/field.ts (tested): resolution steps down when frames run slow and back up when
 *   they don't; after three slow seconds at half resolution it gives up for the still picture;
 * - it draws only while the tab is visible, motion is allowed and the page shows no full-window 3D of its own (the
 *   studio, or anything marked [data-own-backdrop]); idle (no scroll or pointer for a second) it drops to 30 fps;
 * - the grid stays faint in the middle of the screen, where text is, and only shows itself towards the edges.
 * The canvas is persisted across page changes (BaseLayout). window.__field reports its state for the page checks.
 */
import { cameraFor, nextScale, shouldAnimate, shouldFallBack } from "@/lib/look/field";

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
uniform vec4 uCam;      // height, pitch, drift, unused
uniform vec2 uLean;

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
	if (dir.y < -0.002) {
		float dist = uCam.x / -dir.y;
		vec2 p = vec2(dir.x, dir.z) * dist + vec2(0.0, -uCam.z);
		float fade = exp(-dist * 0.045) * smoothstep(0.0, 0.08, -dir.y);
		// Faint in the middle of the screen (where text is), clearer towards the edges.
		float edge = mix(0.3, 1.0, smoothstep(0.2, 0.9, length(vUv * vec2(0.9, 1.0))));
		float g = line(p, 1.0) * 0.55 + plus(p) * 0.9;
		col = mix(col, ink, g * fade * edge * mix(0.17, 0.24, uNight));
		col = mix(col, blue, line(p / 8.0, 1.2) * fade * edge * 0.16);
	}
	outColor = vec4(col, 1.0);
}`;

declare global {
	interface Window {
		__field?: { paused: boolean; scale: number; night: number; frames: number; fallback: boolean };
	}
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
	return shader;
}

function start(canvas: HTMLCanvasElement) {
	const state = (window.__field = { paused: true, scale: 1, night: 1, frames: 0, fallback: false });
	const root = document.documentElement;
	const giveUp = () => {
		state.fallback = true;
		state.paused = true;
		root.classList.add("field-still");
	};
	const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance" });
	if (!gl) return giveUp();
	let program: WebGLProgram;
	try {
		program = gl.createProgram()!;
		gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
		gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
	} catch (error) {
		console.warn("Blueprint space: falling back to the still picture.", error);
		return giveUp();
	}
	gl.useProgram(program);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(program, "aPos");
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
	const u = (name: string) => gl.getUniformLocation(program, name);
	const uRes = u("uRes"), uTime = u("uTime"), uNight = u("uNight"), uCam = u("uCam"), uLean = u("uLean");

	const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
	const ownBackdrop = () => !!document.querySelector("[data-studio]:not([data-read]), [data-own-backdrop]");
	const pointer = { x: 0, y: 0 };
	const eased = { x: 0, y: 0, scroll: 0 };
	let lastInput = performance.now();
	let night = root.classList.contains("dark") ? 1 : 0;
	let raf = 0;
	let last = 0;
	let windowStart = 0;
	let windowFrames = 0;
	let windowMs = 0; // time spent on frames drawn at full rate (idle 30 fps frames say nothing about cost)
	let baseline = Infinity; // the screen's own frame interval (the shortest seen)
	let slowWindows = 0;

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
		const interval = now - last;
		last = now;
		if (interval > 0 && interval < 100) baseline = Math.min(baseline, interval);
		if (!idle && interval < 100) {
			windowFrames++;
			windowMs += interval;
		}
		if (now - windowStart >= 1000) {
			if (windowFrames > 20 && Number.isFinite(baseline)) {
				// Judged against the screen's own rate: 10 means "on time", whatever the refresh rate.
				const average = windowMs / windowFrames;
				const normalised = (10 * average) / baseline - 4;
				const before = state.scale;
				state.scale = nextScale(state.scale, normalised);
				slowWindows = state.scale === 0.5 && normalised > 12 ? slowWindows + 1 : 0;
				if (shouldFallBack(slowWindows)) return giveUp();
				if (state.scale !== before) resize();
			}
			windowStart = now;
			windowFrames = 0;
			windowMs = 0;
		}
		const target = root.classList.contains("dark") ? 1 : 0;
		night += (target - night) * 0.08;
		state.night = night;
		const max = document.documentElement.scrollHeight - innerHeight;
		eased.scroll += ((max > 0 ? scrollY / max : 0) - eased.scroll) * 0.12;
		eased.x += (pointer.x - eased.x) * 0.06;
		eased.y += (pointer.y - eased.y) * 0.06;
		const cam = cameraFor(eased.scroll, eased);
		gl.uniform2f(uRes, canvas.width, canvas.height);
		gl.uniform1f(uTime, now / 1000);
		gl.uniform1f(uNight, night);
		gl.uniform4f(uCam, cam.height, cam.pitch, cam.drift, 0);
		gl.uniform2f(uLean, cam.lean[0], cam.lean[1]);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		state.frames++;
		raf = requestAnimationFrame(frame);
	};

	const running = () =>
		!state.fallback && shouldAnimate({ hidden: document.hidden, reduced: reducedQuery.matches || root.classList.contains("reduce-motion"), ownBackdrop: ownBackdrop() });

	const wake = () => {
		state.paused = !running();
		canvas.hidden = state.fallback || reducedQuery.matches;
		if (!state.paused && !raf) {
			last = performance.now();
			windowStart = last;
			windowFrames = 0;
			windowMs = 0;
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
	// The studio switches to 3D (drops data-read) after load; a page may mark its own full-window 3D.
	new MutationObserver(wake).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-read", "data-own-backdrop"] });
	canvas.addEventListener("webglcontextlost", (event) => {
		event.preventDefault();
		giveUp();
	});
	wake();
}

const canvas = document.querySelector<HTMLCanvasElement>("[data-blueprint]");
if (canvas && !window.__field) start(canvas);
