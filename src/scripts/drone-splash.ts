/**
 * Drone page intro: 5.6 s on a first entry; on a refresh the very same timeline plays FAST_RATE times faster (1.9 s).
 * Clicking through to the drone page from elsewhere on the site plays it too: full the first time in a tab, fast
 * after that (src/lib/splash.ts).
 * Markup and CSS: src/components/DroneSplash.astro. Shared overlay, skip, versions, reduced motion and clean-up:
 * src/scripts/splash-core.ts.
 *
 *   0.0–1.4  the F450 (the drone page's own 3D model) flies in from the far left over a dusk horizon, banking as it
 *            turns toward the camera, flares nose-up to brake and settles into a hover facing it.
 *   1.3–2.0  the camera dives at the drone's webcam and into its lens, until the glass fills the screen.
 *   2.0–3.6  out through the lens as the drone's own view: a burst of static, then the live feed (pushing slowly
 *            forward, film grain, scanlines) and its on-screen display booting: REC with a running timecode, the 4G
 *            link going from WEAK to GOOD, the battery, speed and a climbing altitude, crosshair and horizon brackets.
 *   3.4–4.0  the feed glitches and switches off like an old monitor: squashed to a bright line, then a dot.
 *   4.0–5.0  the dot ripples out into the JPL Innovation logo: the ring draws round, the monitor boots, the waves
 *            pulse out, JPL drops in and INNOVATION comes up round the bottom.
 *   5.0–5.6  the badge flies into the navbar logo (FLIP) while the lettering and the overlay fade.
 *
 * The flight is a WebGL canvas that reads the timeline's clock every frame, so Skip, the fast version and dev seeks
 * (window.__splash.seek) all follow it; it's freed as soon as the lens fills the screen. The rest is transform and
 * opacity animations.
 */
import { DirectionalLight, HemisphereLight, type Material, type Mesh, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { markSeen } from "@/lib/splash";
import { buildDrone } from "@/lib/three/models/drone";
import { E, flip, onScreen, runSplash, type SplashContext } from "./splash-core";

const FAST_RATE = 3; // refresh version: 5.6 s → 1.9 s

/* Timeline marks, in seconds of the full version. */
const DIVE = 1.32; // the camera sets off for the lens...
const LENS = 2.02; // ...and is in it
const FLIGHT_END = 2.1; // the 3D canvas is freed
const FEED = 2.04; // the drone's view comes up
const LINK_UP = 2.86; // the 4G link improves...
const LINK_GOOD = 3.06; // ...to GOOD
const GLITCH = 3.4;
const OFF = 3.62; // the feed switches off: squashed to a line...
const DOT = 3.86; // ...then a dot
const RING = 3.98; // the dot opens into the logo
const FLY = 5.1; // the badge sets off for the navbar...
const LAND = 5.5; // ...and lands
const END = 5.62;

const FOV = 38;
const root = document.documentElement;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => clamp01(x) * clamp01(x) * (3 - 2 * clamp01(x));
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Keyframes at absolute times: [seconds, props, easing to the next step]. */
type Step = [number, Keyframe, string?];

/**
 * The drone's flight, in metres with the camera at the origin looking down −z: [t, x, y, z, yaw°, nose-down°, roll°].
 * Yaw 0 faces the camera; positive roll banks right. Played through smoothly (Hermite curves through the keys).
 */
const PATH: number[][] = [
	[0.0, -4.6, 1.25, -8.4, 50, 15, 14],
	[0.42, -2.6, 0.82, -5.6, 42, 14, 24],
	[0.82, -0.95, 0.38, -2.9, 22, 7, 18],
	[1.12, -0.18, 0.15, -1.48, 6, -13, 5], // flares nose-up to brake
	[1.38, 0, 0.08, -1.0, 0, -6, -1],
	[1.6, 0, 0.055, -0.95, 0, 2, 0], // hover
	[2.2, 0, 0.05, -0.95, 0, 0, 0],
];
function track(keys: number[][]) {
	const n = keys.length;
	return (t: number) => {
		if (t <= keys[0][0]) return keys[0].slice(1);
		if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
		let i = 0;
		while (keys[i + 1][0] < t) i++;
		const [p0, p1, p2, p3] = [keys[Math.max(0, i - 1)], keys[i], keys[i + 1], keys[Math.min(n - 1, i + 2)]];
		const h = p2[0] - p1[0];
		const u = (t - p1[0]) / h;
		const [h00, h10, h01, h11] = [2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2];
		return p1.slice(1).map((v, j) => {
			const m1 = ((p2[j + 1] - p0[j + 1]) / (p2[0] - p0[0] || 1)) * h;
			const m2 = ((p3[j + 1] - p1[j + 1]) / (p3[0] - p1[0] || 1)) * h;
			return h00 * v + h10 * m1 + h01 * p2[j + 1] + h11 * m2;
		});
	};
}
const flightAt = track(PATH);

/** A small grey noise tile for the film grain and the static (deterministic, so every run looks the same). */
function noiseTile() {
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const g = c.getContext("2d");
	if (!g) return "none";
	const img = g.createImageData(128, 128);
	let seed = 10951;
	for (let i = 0; i < img.data.length; i += 4) {
		seed = (seed * 16807) % 2147483647;
		img.data[i] = img.data[i + 1] = img.data[i + 2] = seed % 256;
		img.data[i + 3] = 255;
	}
	g.putImageData(img, 0, 0);
	return `url(${c.toDataURL()})`;
}

/**
 * The 3D flight: the drone, a camera that follows it a little and then dives into its lens, and the sky behind
 * them panning the opposite way. Built and drawn once before the timeline starts, so the first frame is ready.
 */
function prepareFlight(canvas: HTMLCanvasElement, sky: HTMLElement | null) {
	let renderer: WebGLRenderer;
	try {
		renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
	} catch {
		return undefined; // no WebGL: the sky shows on its own and the rest of the intro still plays
	}
	const coarse = matchMedia("(pointer: coarse)").matches;
	renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.75));
	renderer.setSize(innerWidth, innerHeight, false);
	renderer.setClearColor(0x000000, 0);
	const scene = new Scene();
	scene.add(new HemisphereLight(0x9adfea, 0x020608, 1.2));
	const key = new DirectionalLight(0xeaf8ff, 1.9); // from the camera's side
	key.position.set(-2, 3, 5);
	const rim = new DirectionalLight(0x40d2e8, 3.4); // the bright horizon behind the drone
	rim.position.set(0.6, 1.4, -6);
	scene.add(key, rim);
	const aspect = innerWidth / innerHeight;
	const camera = new PerspectiveCamera(FOV, aspect, 0.002, 60);
	const rig = buildDrone();
	const drone = rig.model;
	drone.rotation.order = "YXZ"; // heading, then pitch, then bank
	scene.add(drone);

	// On a narrow (phone) screen the whole flight happens further away, so the hovering drone still fits across it,
	// and the camera turns further toward the drone, so it's in the frame sooner. The camera starts looking straight
	// at the hover point and only then turns toward the drone (so the sky doesn't jump when the script takes over).
	const s = Math.max(1, 0.8 / (2 * Math.tan(rad(FOV / 2)) * aspect) / 0.95);
	const followMax = aspect < 1 ? 0.65 : 0.3;
	const hover = new Vector3(0, 0.055 * s, -0.95 * s);
	const pxPerRad = innerHeight / rad(FOV); // how far the far sky slides when the camera turns
	const handheld = (t: number, out: Vector3) => out.set(0.006 * Math.sin(t * 1.7), 0.004 * Math.sin(t * 2.3 + 1), 0);
	let follow = 0;
	let view0: [number, number] | undefined; // the camera's first heading and tilt (the sky starts untransformed)

	const lensAt = new Vector3();
	const lensDir = new Vector3();
	const aim = new Vector3();
	const start = new Vector3();
	const via = new Vector3();
	const end = new Vector3();
	const toDrone = new Vector3();
	const toHover = new Vector3();
	/** Where the camera looks while the drone flies in: toward the hover point, turned part of the way to the drone. */
	const flightAim = (out: Vector3) => {
		toDrone.copy(drone.position).sub(camera.position).normalize();
		toHover.copy(hover).sub(camera.position).normalize();
		return out.copy(toHover).lerp(toDrone, follow).add(camera.position);
	};

	const pose = (t: number) => {
		const [x, y, z, yaw, nose, roll] = flightAt(t);
		// A small hover bob, gone again before the camera reaches the lens.
		const bob = 0.004 * Math.sin(t * 7) * smooth((t - 1.3) / 0.25) * (1 - smooth((t - 1.6) / 0.3));
		drone.position.set(x * s, y * s + bob, z * s);
		drone.rotation.set(rad(nose), rad(yaw), rad(roll));
		drone.updateMatrixWorld(true);
		follow = followMax * smooth(t / 0.45);
		if (t < DIVE) {
			handheld(t, camera.position);
			camera.fov = FOV;
			camera.lookAt(flightAim(aim));
		} else {
			// Into the lens: a curve that ends straight down the lens's axis, speeding up all the way.
			rig.lens.getWorldPosition(lensAt);
			rig.lens.getWorldDirection(lensDir);
			const u = clamp01((t - DIVE) / (LENS - DIVE));
			const e = u ** 2.4;
			handheld(DIVE, start);
			via.copy(lensAt).addScaledVector(lensDir, 0.42 * s);
			end.copy(lensAt).addScaledVector(lensDir, 0.011);
			camera.position.set(0, 0, 0).addScaledVector(start, (1 - e) ** 2).addScaledVector(via, 2 * (1 - e) * e).addScaledVector(end, e * e);
			camera.fov = FOV + 8 * e;
			const look = flightAim(aim).lerp(lensAt, smooth(u / 0.55));
			camera.lookAt(look);
		}
		camera.updateProjectionMatrix();
		if (sky) {
			// The sky is at infinity: it slides against the camera's turn and swells a little as the camera dives.
			const dir = camera.getWorldDirection(aim);
			const turn = Math.atan2(dir.x, -dir.z);
			const tilt = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
			view0 ??= [turn, tilt];
			const zoom = 1 + 0.08 * smooth((t - DIVE) / (LENS - DIVE));
			sky.style.transform = `translate(${(-(turn - view0[0]) * pxPerRad).toFixed(1)}px, ${((tilt - view0[1]) * pxPerRad).toFixed(1)}px) scale(${zoom.toFixed(4)})`;
		}
	};

	let last = 0;
	const draw = (t: number, playing: boolean) => {
		pose(t);
		rig.animate(t, playing ? Math.max(0, t - last) : 0);
		last = t;
		renderer.render(scene, camera);
	};
	// Compile the shaders and draw the first frame now, before the clock starts.
	pose(0);
	renderer.compile(scene, camera);
	draw(0, false);

	let freed = false;
	return {
		draw,
		free() {
			if (freed) return;
			freed = true;
			scene.traverse((o) => {
				const mesh = o as Mesh;
				mesh.geometry?.dispose();
				const material = mesh.material as Material | Material[] | undefined;
				for (const m of Array.isArray(material) ? material : material ? [material] : []) m.dispose();
			});
			renderer.dispose();
			canvas.width = canvas.height = 0;
			canvas.remove();
		},
	};
}

function play(ctx: SplashContext) {
	const { el, tween } = ctx;
	markSeen("drone"); // later in-site arrivals in this tab get the fast version
	const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel);

	/** One animation per element and property, through keyframes at absolute times (two would fight, see frc-splash). */
	const seq = (target: Element | null | undefined, steps: Step[]) => {
		const t0 = steps[0][0];
		const t1 = steps[steps.length - 1][0];
		return tween(
			target,
			steps.map(([t, props, easing]) => ({ ...props, offset: (t - t0) / (t1 - t0), ...(easing ? { easing } : {}) })),
			t0,
			t1 - t0,
			"linear",
		);
	};
	const fade = (target: Element | null | undefined, t0: number, t1: number, from = 0, to = 1, easing = E.inOut) =>
		seq(target, [
			[t0, { opacity: from }, easing],
			[t1, { opacity: to }],
		]);

	el.style.setProperty("--ds-noise", noiseTile());
	const sky = q("[data-ds-sky]");
	const canvas = q<HTMLCanvasElement>("[data-ds-3d]");
	const feed = q("[data-ds-feed]")!;
	const badge = q("[data-ds-badge]")!;

	// The logo's ring centre on screen: the switch-off line, dot and ripple all close onto it.
	const b0 = badge.getBoundingClientRect();
	const half = Number(badge.dataset.half);
	const cx = b0.left + b0.width / 2;
	const cy = b0.top + b0.height / 2;
	el.style.setProperty("--ds-cx", `${cx}px`);
	el.style.setProperty("--ds-cy", `${cy}px`);
	el.style.setProperty("--ds-ring", `${(b0.width * 119.6) / half}px`);
	feed.style.transformOrigin = `${cx}px ${cy}px`;

	/* ---------- 1. The flight (0.0–2.1 s) ---------- */
	const flight = canvas ? prepareFlight(canvas, sky) : undefined;
	if (!flight) canvas?.remove();
	// One clock for everything drawn by script (the 3D and the on-screen display's numbers).
	const clock = tween(feed, [{ visibility: "visible" }, { visibility: "visible" }], 0, OFF, "linear");
	seq(q("[data-ds-black]"), [
		[1.92, { opacity: 0 }, E.in],
		[LENS, { opacity: 1 }],
		[FEED + 0.01, { opacity: 1 }, E.out],
		[FEED + 0.12, { opacity: 0 }],
	]);
	seq(sky, [
		[0, { opacity: 1 }],
		[FEED - 0.01, { opacity: 1 }],
		[FEED, { opacity: 0 }],
	]);

	/* ---------- 2. Through the lens: the drone's own view (2.0–3.6 s) ---------- */
	seq(feed, [
		[FEED - 0.02, { opacity: 0 }],
		[FEED - 0.01, { opacity: 1 }],
		[OFF + 0.13, { opacity: 1 }],
		[OFF + 0.17, { opacity: 0 }],
	]);
	// Pushing slowly forward with a slight roll, then the glitch jitter and the squash to a line.
	seq(q("[data-ds-feed-img]"), [
		[FEED, { transform: "scale(1) rotate(-0.5deg)" }],
		[OFF, { transform: "scale(1.07) rotate(0.4deg)" }],
	]);
	const jitter: Step[] = [[GLITCH, { transform: "translateX(0) scale(1, 1)" }]];
	const rnd = random(4005);
	for (let t = GLITCH + 0.03; t < OFF - 0.02; t += 0.035) jitter.push([t, { transform: `translateX(${((rnd() * 2 - 1) * 14).toFixed(1)}px) scale(1, 1)` }, "steps(1)"]);
	jitter.push([OFF, { transform: "translateX(0) scale(1, 1)" }, E.in], [OFF + 0.14, { transform: "translateX(0) scale(1, 0.006)" }]);
	seq(feed, jitter);
	seq(feed, [
		[OFF, { filter: "brightness(1)" }, E.in],
		[OFF + 0.14, { filter: "brightness(2.6)" }],
	]);
	// Static: a burst as the picture comes up, and again through the glitch.
	seq(q("[data-ds-static]"), [
		[FEED - 0.01, { opacity: 0 }],
		[FEED, { opacity: 0.9 }, E.out],
		[FEED + 0.1, { opacity: 0.45 }, E.out],
		[FEED + 0.3, { opacity: 0 }],
		[GLITCH, { opacity: 0 }, E.out],
		[GLITCH + 0.05, { opacity: 0.35 }, E.in],
		[GLITCH + 0.1, { opacity: 0.05 }, E.out],
		[GLITCH + 0.16, { opacity: 0.5 }, E.in],
		[OFF, { opacity: 0.75 }, E.out],
		[OFF + 0.12, { opacity: 0 }],
	]);
	// The on-screen display boots: each corner types in, the crosshair pops up, the horizon brackets slide out.
	el.querySelectorAll("[data-ds-hud-block]").forEach((block, i) => {
		const t = FEED + 0.08 + i * 0.06;
		seq(block, [
			[t, { opacity: 0 }],
			[t + 0.02, { opacity: 1 }],
			[GLITCH + 0.04, { opacity: 1 }, "steps(1)"],
			[GLITCH + 0.07, { opacity: 0.25 }, "steps(1)"],
			[GLITCH + 0.11, { opacity: 1 }, "steps(1)"],
			[GLITCH + 0.15, { opacity: 0.35 }, "steps(1)"],
			[GLITCH + 0.18, { opacity: 1 }],
		]);
		seq(block, [
			[t, { clipPath: "inset(0 100% 0 0)" }, "steps(14)"],
			[t + 0.3, { clipPath: "inset(0 0% 0 0)" }],
		]);
	});
	fade(q("[data-ds-cross]"), FEED + 0.1, FEED + 0.14);
	seq(q("[data-ds-cross]"), [
		[FEED + 0.1, { transform: "scale(0.2)" }, E.outBack],
		[FEED + 0.36, { transform: "scale(1)" }],
	]);
	el.querySelectorAll("[data-ds-bracket]").forEach((bracket) => {
		fade(bracket, FEED + 0.16, FEED + 0.2);
		seq(bracket, [
			[FEED + 0.16, { transform: "scaleX(0)" }, E.out],
			[FEED + 0.44, { transform: "scaleX(1)" }],
		]);
	});
	tween(
		q("[data-ds-rec]"),
		[
			{ opacity: 1, offset: 0 },
			{ opacity: 1, offset: 0.55 },
			{ opacity: 0.15, offset: 0.56 },
			{ opacity: 0.15, offset: 1 },
		],
		FEED + 0.2,
		0.8,
		"linear",
		{ iterations: 2 },
	);
	const hud = feedNumbers(el);

	/* ---------- 3. The feed switches off into a dot (3.6–4.0 s) ---------- */
	seq(q("[data-ds-crt-line]"), [
		[OFF + 0.1, { opacity: 0 }],
		[OFF + 0.14, { opacity: 1 }],
		[DOT + 0.06, { opacity: 1 }],
		[DOT + 0.1, { opacity: 0 }],
	]);
	seq(q("[data-ds-crt-line]"), [
		[OFF + 0.14, { transform: "scaleX(1)" }, E.in],
		[DOT + 0.08, { transform: "scaleX(0.01)" }],
	]);
	seq(q("[data-ds-crt-dot]"), [
		[DOT + 0.02, { opacity: 0 }],
		[DOT + 0.06, { opacity: 1 }],
		[RING + 0.05, { opacity: 1 }, E.out],
		[RING + 0.24, { opacity: 0 }],
	]);
	seq(q("[data-ds-crt-dot]"), [
		[DOT + 0.02, { transform: "scale(0.6)" }, E.outBack],
		[RING, { transform: "scale(1.7)" }, E.in],
		[RING + 0.24, { transform: "scale(0.3)" }],
	]);
	seq(q("[data-ds-ripple]"), [
		[RING, { opacity: 0 }],
		[RING + 0.03, { opacity: 0.9 }, E.out],
		[RING + 0.42, { opacity: 0 }],
	]);
	seq(q("[data-ds-ripple]"), [
		[RING, { transform: "scale(0.04)" }, E.outExpo],
		[RING + 0.36, { transform: "scale(1)" }],
	]);

	/* ---------- 4. The JPL Innovation logo (4.0–5.0 s) ---------- */
	const $ = (id: string) => el.querySelector<SVGGraphicsElement>(`#ds-${id}`);
	seq(q("[data-ds-glow]"), [
		[RING + 0.1, { opacity: 0 }, E.out],
		[RING + 0.5, { opacity: 1 }],
		[FLY - 0.05, { opacity: 1 }, E.out],
		[FLY + 0.2, { opacity: 0 }],
	]);
	for (const id of ["ring-rim", "ring"]) {
		tween(
			$(id),
			[
				{ opacity: 0, strokeDashoffset: 1 },
				{ opacity: 1, strokeDashoffset: 0.94, offset: 0.06 },
				{ opacity: 1, strokeDashoffset: 0 },
			],
			RING + 0.04,
			0.44,
			E.inOut,
		);
	}
	tween($("badge-fill"), [{ opacity: 0, scale: "0.9" }, { opacity: 1, scale: "1" }], RING + 0.08, 0.4, E.outExpo);
	for (const [line, fill, t] of [
		["bezel-line", "bezel", RING + 0.14],
		["frame-line", "frame", RING + 0.2],
	] as const) {
		tween(
			$(line),
			[
				{ opacity: 1, strokeDashoffset: 1, easing: E.inOut },
				{ opacity: 1, strokeDashoffset: 0, offset: 0.68, easing: E.out },
				{ opacity: 0, strokeDashoffset: 0 },
			],
			t,
			0.5,
			"linear",
		);
		tween($(fill), [{ opacity: 0 }, { opacity: 1 }], t + 0.24, 0.22, E.out);
	}
	el.querySelectorAll(".ds-badge .ds-stand").forEach((part, i) => {
		tween(part, [{ opacity: 0, translate: "0 10px" }, { opacity: 1, translate: "0 0" }], RING + 0.3 + i * 0.035, 0.36, E.outExpo);
	});
	tween($("wrench-x"), [{ opacity: 0, rotate: "-100deg", scale: "0.6" }, { opacity: 1, rotate: "0deg", scale: "1" }], RING + 0.24, 0.42, E.outBack);
	// The screen flickers on: 0 → 60 → 20 → 100 %, with a soft glow.
	tween(
		$("screen"),
		[
			{ opacity: 0, easing: E.outExpo },
			{ opacity: 0.6, offset: 0.28, easing: E.in },
			{ opacity: 0.2, offset: 0.5, easing: E.outExpo },
			{ opacity: 1 },
		],
		RING + 0.36,
		0.28,
		"linear",
	);
	tween(
		$("screen-glow"),
		[
			{ opacity: 0, easing: E.outExpo },
			{ opacity: 0.9, offset: 0.12, easing: E.in },
			{ opacity: 0.35, offset: 0.22, easing: E.outExpo },
			{ opacity: 1, offset: 0.36, easing: E.inOutSine },
			{ opacity: 0 },
		],
		RING + 0.36,
		0.8,
		"linear",
	);
	// Signal waves pulse out from the wrench, inner pair first.
	[["wave-l1", "wave-r1"], ["wave-l2", "wave-r2"], ["wave-l3", "wave-r3"]].forEach((pair, k) => {
		for (const id of pair) {
			tween(
				$(id),
				[
					{ opacity: 0, scale: "0.4", easing: E.outExpo },
					{ opacity: 1, scale: "1.08", offset: 0.55, easing: E.inOutSine },
					{ opacity: 1, scale: "1" },
				],
				RING + 0.5 + k * 0.085,
				0.4,
				"linear",
			);
		}
	});
	// JPL drops in; INNOVATION comes up letter by letter round the bottom.
	el.querySelectorAll(".js-jpl").forEach((letter, i) => {
		tween(letter, [{ opacity: 0, translate: "0 -22px", scale: "0.85" }, { opacity: 1, translate: "0 0", scale: "1" }], RING + 0.48 + i * 0.06, 0.34, E.outBackSoft);
	});
	el.querySelectorAll(".js-innovation").forEach((letter, i) => {
		tween(letter, [{ opacity: 0, scale: "0.4" }, { opacity: 1, scale: "1" }], RING + 0.6 + i * 0.04, 0.3, E.outBack);
	});

	/* ---------- 5. Into the navbar (5.0–5.6 s) ---------- */
	const nav = navLogo();
	fade(q(".ds-letters"), FLY - 0.08, FLY + 0.1, 1, 0, E.out);
	const flight2 = tween(badge, [{ transform: "none" }, { transform: badgeTarget(badge, half, nav.img) }], FLY, LAND - FLY, E.fly);
	const retarget = () => (flight2?.effect as KeyframeEffect | undefined)?.setKeyframes([{ transform: "none" }, { transform: badgeTarget(badge, half, navLogo().img) }]);
	ctx.at(FLY - 0.06, () => {
		if (flight2 && flight2.playState === "running" && Number(flight2.currentTime) < FLY * 1000) retarget();
	});
	fade(q("[data-splash-bg]"), FLY + 0.1, LAND, 1, 0, E.out);
	fade(q("[data-splash-skip]"), FLY - 0.3, FLY, 1, 0, E.out);
	ctx.at(FLY + 0.1, () => root.classList.add("splash-leaving"));
	tween(badge, [{ opacity: 1 }, { opacity: 0 }], LAND - 0.02, END - LAND + 0.02, E.inOut);
	ctx.endWith(tween(nav.wrap, [{ opacity: 0 }, { opacity: 1 }], LAND - 0.02, END - LAND + 0.02, E.inOut));

	/* ---------- The clock: the 3D flight and the display's numbers ---------- */
	let raf = 0;
	const tick = () => {
		if (!clock) return;
		const t = Number(clock.currentTime ?? 0) / 1000;
		const paused = clock.playState === "paused"; // a dev seek
		if (flight) {
			if (t <= FLIGHT_END) flight.draw(t, !paused);
			else if (!paused) flight.free();
		}
		hud(t);
		if (t >= OFF && !paused) return;
		raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);
	ctx.onCleanup(() => {
		cancelAnimationFrame(raf);
		flight?.free();
	});
	ctx.devExtras({ retarget });
}

/** Deterministic "random" numbers, so every run looks the same. */
function random(seed: number) {
	return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** The on-screen display's live numbers at time t: timecode, link, speed and altitude. */
function feedNumbers(el: HTMLElement) {
	const q = (sel: string) => el.querySelector<HTMLElement>(sel);
	const tc = q("[data-ds-tc]");
	const bars = q("[data-ds-bars]");
	const link = q("[data-ds-link]");
	const mbps = q("[data-ds-mbps]");
	const ms = q("[data-ds-ms]");
	const spd = q("[data-ds-spd]");
	const alt = q("[data-ds-alt]");
	const set = (node: HTMLElement | null, text: string) => {
		if (node && node.textContent !== text) node.textContent = text;
	};
	const two = (n: number) => String(n).padStart(2, "0");
	return (t: number) => {
		const live = Math.max(0, t - FEED);
		const frames = 198 * 30 + Math.floor(live * 30); // starts at 00:03:18:00, 30 frames a second
		set(tc, `${two(Math.floor(frames / 108000))}:${two(Math.floor(frames / 1800) % 60)}:${two(Math.floor(frames / 30) % 60)}:${two(frames % 30)}`);
		const level = t < LINK_UP ? 1 : t < LINK_GOOD ? 2 : 3;
		if (bars && bars.dataset.level !== String(level)) bars.dataset.level = String(level);
		if (link) set(link, (level === 3 ? link.dataset.good : link.dataset.weak) ?? "");
		set(mbps, ["0.9", "2.1", "3.8"][level - 1]);
		set(ms, ["340", "180", "96"][level - 1]);
		set(spd, (10.1 + 0.3 * Math.sin(t * 3.1)).toFixed(1));
		set(alt, (42.9 + 0.35 * live + 0.05 * Math.sin(t * 7)).toFixed(1));
	};
}

/** The navbar logo that's showing (light or dark variant). */
function navLogo() {
	const wrap = document.querySelector<HTMLElement>("[data-site-header] [data-site-logo]");
	const img = wrap && [...wrap.querySelectorAll("img")].find((i) => i.getClientRects().length > 0);
	return { wrap, img };
}

/**
 * Transform (origin: top-left) that puts the intro's badge box exactly over the badge in the navbar logo. The navbar
 * image shows jpl-logo.svg's view box (49 40 687 248), whose ring is centred at 610.9, 163.9; the intro's badge box
 * is `half` units either side of that centre.
 */
function badgeTarget(badge: HTMLElement, half: number, img: HTMLImageElement | null | undefined) {
	const from = badge.getBoundingClientRect();
	const to = img?.getBoundingClientRect();
	if (!onScreen(to)) {
		// Header hidden or off-screen (e.g. the page opened scrolled down): shrink away in place instead.
		const k = 0.9;
		return `translate(${(from.width * (1 - k)) / 2}px, ${(from.height * (1 - k)) / 2}px) scale(${k})`;
	}
	const u = to!.width / 687; // navbar pixels per logo unit
	return flip(from, new DOMRect(to!.left + (610.9 - half - 49) * u, to!.top + (163.9 - half - 40) * u, 2 * half * u, 2 * half * u));
}

// On a real page load the overlay is already up when this runs. On an in-site arrival SplashShell puts it up during
// the page swap: the first time, that swap is also what loads this script (so the call below starts it); after that
// the script has already run, and the router's after-swap event starts it instead.
const start = () => runSplash("drone", play, { fastRate: FAST_RATE });
start();
document.addEventListener("astro:after-swap", start);

export {};
