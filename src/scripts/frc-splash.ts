/**
 * FRC page intro: 4.8 s on a first entry; on a refresh the very same timeline plays FAST_RATE times faster (1.5 s).
 * Clicking through to the FRC page from elsewhere on the site plays it too: full the first time in a tab, fast
 * after that (src/lib/splash.ts).
 * Markup and CSS: src/components/FrcSplash.astro (+ FrcLockup.astro); colour burn geometry: src/lib/frc-burn.ts.
 * Shared overlay, skip, versions, reduced motion and clean-up: src/scripts/splash-core.ts.
 *
 *   0.0–1.6  the FIRST mark builds: a red triangle drops in and bounces, a white circle rolls in, a blue square
 *            spins in and lands; they slide and rotate into the knot, lock with a "click", become the
 *            full-colour FIRST logo, and the wordmark wipes in.
 *   1.6–2.2  the dragon flies in from the left on a curve with a wing-flap wobble, stops left of the logo and
 *            rears back to wind up.
 *   2.2–3.6  a long breath of fire sweeps across the logo, left to right and a little up and down, and the
 *            colours burn off right behind the flame (a ragged glowing edge, charcoal cooling to white).
 *            Firelight, embers and sparks, a small camera shake and a slight heat shimmer.
 *   3.6–4.0  the fire dies into smoke and fading embers; the dragon settles into its badge, the real badge and the
 *            official white FIRST logo take over, the divider draws in and the caption fades up.
 *   4.0–4.8  the lockup scales down and flies into its exact spot in the page header (FLIP); the overlay fades.
 *
 * Only transform / opacity / filter animations; the fire is its own canvas. The lockup, the dragon and the burn
 * windows move as HTML layers, so the GPU compositor keeps them smooth.
 */
import { BURN_CLEAR } from "@/lib/frc-burn";
import { markFrcSeen } from "@/lib/splash";
import { E, flip, onScreen, runSplash, type SplashContext } from "./splash-core";

const FAST_RATE = 3.2; // refresh version: 4.8 s → 1.5 s

/* Timeline marks, in seconds of the full version. */
const FIRE_START = 2.2; // the dragon breathes
const SWEEP_START = 2.3; // the flame starts across the logo...
const SWEEP_END = 3.38; // ...and reaches its far end
const FIRE_STOP = 3.48; // no new flame after this
const SETTLE = 3.5; // the dragon starts settling into its badge
const SMOKE_END = 4.0; // the last smoke is gone and the fire canvas is freed
const FLY_START = 4.04;
const LAND = 4.64;
const END = 4.8;

const root = document.documentElement;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sine = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(p)); // sine in-out, 0 → 1

/** Where the flame hits the logo at time t. x: logo widths from its left edge; y: logo heights from its middle. */
const aimX = (t: number) => -0.1 + 1.2 * sine((t - SWEEP_START) / (SWEEP_END - SWEEP_START));
const aimY = (t: number) => 0.17 * Math.sin((2 * Math.PI * (t - SWEEP_START)) / 0.6) * sine((t - FIRE_START) / 0.2);
/** How hard it's breathing, 0–1. */
const intensity = (t: number) => sine((t - FIRE_START) / 0.12) * (1 - sine((t - (FIRE_STOP - 0.16)) / 0.16));
/** The burn front: just behind the hit point, parked clear of the logo before and after. */
const FRONT_LAG = 0.1;
const frontX = (t: number) => Math.min(1 + BURN_CLEAR + 0.01, Math.max(-BURN_CLEAR - 0.01, aimX(t - FRONT_LAG) - 0.015));
const frontY = (t: number) => 0.35 * aimY(t - FRONT_LAG);

/** Deterministic "random" numbers, so every run (and every dev seek) looks the same. */
function random(seed: number) {
	return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Box `dx/dy/w/h` of a child relative to its lockup. */
type Box = { dx: number; dy: number; w: number; h: number };
/** Keyframes at absolute times: [seconds, props, easing to the next step]. */
type Step = [number, Keyframe, string?];

function play(ctx: SplashContext) {
	const { el, tween } = ctx;
	markFrcSeen(); // later in-site arrivals in this tab get the fast version
	const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel);
	const lockup = q('[data-frc-lockup="splash"]')!;
	const frame = q("[data-frc-frame]")!;
	const page = document.querySelector<HTMLElement>('[data-frc-lockup="page"]');
	// The splash brings the header's lockup in, so the scroll-reveal script must leave it alone.
	page?.removeAttribute("data-reveal");

	/**
	 * One animation per element and property, through keyframes at absolute times.
	 * (Two animations on the same property would fight: the later one holds its first frame while it waits.)
	 */
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

	/* ---------- Geometry ---------- */
	// The splash lockup has exactly the header lockup's layout (same component, same classes), so its sizes are
	// read from the header's copy, which is never transformed. Its own untransformed box is centred in `frame`.
	const measure = () => {
		const ref = page ?? lockup;
		const H = ref.getBoundingClientRect();
		const f = frame.getBoundingClientRect();
		const rel = (sel: string): Box => {
			const r = ref.querySelector(sel)!.getBoundingClientRect();
			return { dx: r.left - H.left, dy: r.top - H.top, w: r.width, h: r.height };
		};
		const U = new DOMRect(f.left + (f.width - H.width) / 2, f.top + (f.height - H.height) / 2, H.width, H.height);
		return { H, U, row: rel("[data-frc-row]"), badge: rel("[data-frc-badge]"), first: rel("[data-frc-first]") };
	};
	const vw = innerWidth;
	const vh = innerHeight;
	const cx = vw / 2;
	const cy = vh * 0.46;
	const g0 = measure();
	// Big while it builds and burns (sized by the logo row), then the size at which the whole lockup, caption
	// included, fits: the final frame, identical to the header in proportion.
	const kFinal = Math.min(2.3, (0.86 * vw) / g0.U.width, (0.42 * vh) / g0.U.height);
	const kBig = Math.max(kFinal, Math.min(2.6, (0.86 * vw) / g0.row.w, (0.3 * vh) / g0.row.h));
	const tf = (tx: number, ty: number, k: number) => `translate(${tx}px, ${ty}px) scale(${k})`;
	const bigShift = (g = g0): [number, number] => [cx - (g.row.w * kBig) / 2 - g.U.left - g.row.dx * kBig, cy - (g.row.h * kBig) / 2 - g.U.top - g.row.dy * kBig];
	const poseBig = (g = g0) => tf(...bigShift(g), kBig);
	const poseFinal = (g = g0) => tf(cx - (g.U.width * kFinal) / 2 - g.U.left, cy - (g.U.height * kFinal) / 2 - g.U.top, kFinal);
	const poseHeader = (g = g0) => {
		if (page && onScreen(g.H)) return flip(g.U, g.H);
		// Header scrolled away (e.g. opened at a #section): shrink away in place instead.
		const k = kFinal * 0.92;
		return tf(cx - (g.U.width * k) / 2 - g.U.left, cy - (g.U.height * k) / 2 - g.U.top, k);
	};
	const lockupFrames = (g = g0) => {
		const T = LAND;
		return [
			{ transform: poseBig(g), offset: 0 },
			{ transform: poseBig(g), offset: 3.56 / T, easing: E.inOut },
			{ transform: poseFinal(g), offset: 3.98 / T },
			{ transform: poseFinal(g), offset: FLY_START / T, easing: E.fly },
			{ transform: poseHeader(g), offset: 1 },
		];
	};
	const flight = tween(lockup, lockupFrames(), 0, LAND, "linear");
	// Re-measure before each move (the webfont or late images can shift the header by a pixel or two).
	const retarget = () => (flight?.effect as KeyframeEffect | undefined)?.setKeyframes(lockupFrames(measure()));
	ctx.at(3.48, retarget);
	ctx.at(3.98, retarget);

	// Screen boxes while the lockup is big: the badge (to start the dragon off-screen) and the FIRST logo (for the fire).
	const [btx, bty] = bigShift();
	const badgeLeft = g0.U.left + btx + g0.badge.dx * kBig;
	const badgeTop = g0.U.top + bty + g0.badge.dy * kBig;
	const B = g0.badge.w * kBig;
	const logo = { L: g0.U.left + btx + g0.first.dx * kBig, T: g0.U.top + bty + g0.first.dy * kBig, W: g0.first.w * kBig, H: g0.first.h * kBig };

	/* ---------- 1. The FIRST mark builds (0.0–1.6 s) ---------- */
	// Each shape layer covers the FIRST logo's box; percentages are of that box. "Rest" is where the shape lands
	// first; "lock" (identity, or the circle's ellipse) is its place in the knot.
	const tri = q(".frc-shape-tri");
	const circ = q(".frc-shape-circle");
	const sq = q(".frc-shape-square");
	const T3 = (x: number, y: number, r: number, sx = 1, sy = sx) => `translate(${x}%, ${y}%) rotate(${r}deg) scale(${sx}, ${sy})`;
	// Triangle: drops in, bounces, settles; then slides and rotates into the knot.
	seq(tri, [
		[0.02, { transform: T3(-6, -210, -24) }, E.in],
		[0.28, { transform: T3(-6, 22, -8, 1.16, 0.8) }, E.out], // impact
		[0.38, { transform: T3(-6, 6, -11, 0.95, 1.06) }, E.in], // bounce
		[0.46, { transform: T3(-6, 22, -8, 1.05, 0.95) }, E.out],
		[0.52, { transform: T3(-6, 22, -8) }],
		[0.92, { transform: T3(-6, 22, -8) }, E.inOut],
		[1.26, { transform: T3(0, 0, 0) }],
	]);
	// Circle: rolls in from the left and wobbles to a stop; then becomes the knot's ellipse.
	seq(circ, [
		[0.24, { transform: T3(-170, 18, -640) }, E.out2],
		[0.571, { transform: T3(1, 18, 0) }, E.out],
		[0.626, { transform: T3(1, 18, 0, 0.9, 1.1) }, E.inOutSine],
		[0.668, { transform: T3(1, 18, 0, 1.04, 0.97) }, E.inOutSine],
		[0.7, { transform: T3(1, 18, 0) }],
		[0.95, { transform: T3(1, 18, 0) }, E.inOut],
		[1.29, { transform: T3(0, 0, 0, 1.06, 0.87) }],
	]);
	// Square: spins in and lands; then turns into the knot's diamond.
	seq(sq, [
		[0.44, { transform: T3(70, -170, 585, 0.6) }, E.outExpo],
		[0.762, { transform: T3(8, 16, 45, 1.08, 0.9) }, E.out], // lands
		[0.831, { transform: T3(8, 16, 45, 0.97, 1.04) }, E.inOutSine],
		[0.9, { transform: T3(8, 16, 45) }],
		[0.98, { transform: T3(8, 16, 45) }, E.inOut],
		[1.32, { transform: T3(0, 0, 0) }],
	]);
	for (const [shape, t] of [
		[tri, 0.02],
		[circ, 0.24],
		[sq, 0.44],
	] as const) {
		seq(shape, [
			[t, { opacity: 0 }, E.out],
			[t + 0.08, { opacity: 1 }],
			[1.32, { opacity: 1 }, E.inOut],
			[1.52, { opacity: 0 }],
		]);
	}
	// Lock "click": a quick pulse of the whole mark, then the shapes become the full-colour FIRST knot.
	tween(q("[data-frc-first-layers]"), [{ transform: "scale(1)" }, { transform: "scale(1.07)", offset: 0.4, easing: E.outBack }, { transform: "scale(1)" }], 1.3, 0.24, E.inOutSine);
	fade(q(".frc-knot"), 1.3, 1.5);
	// The FIRST wordmark wipes in beside it.
	seq(q("[data-frc-wipe]"), [
		[1.36, { opacity: 0, transform: "translateX(-100%)" }],
		[1.37, { opacity: 1, transform: "translateX(-100%)" }, E.out],
		[1.66, { opacity: 1, transform: "translateX(0)" }],
	]);
	seq(q("[data-frc-wipe-inner]"), [
		[1.37, { transform: "translateX(100%)" }, E.out],
		[1.66, { transform: "translateX(0)" }],
	]);

	/* ---------- 2. The dragon arrives and winds up (1.6–2.2 s) ---------- */
	const startX = -((badgeLeft + B * 1.6) / B) * 100; // fully off the left edge (percent of the badge box)
	const HOVER = { x: -26, y: -22, k: 1.25 }; // left of the FIRST logo, over its badge's spot, a bit bigger
	const K = HOVER.k;
	fade(q("[data-frc-dragon-x]"), 1.6, 1.7, 0, 1, E.out);
	// x sweeps in while y climbs and dips, which bends the path into a curve; then a rear-back and a lunge.
	seq(q("[data-frc-dragon-x]"), [
		[1.6, { transform: `translateX(${startX}%)` }, E.out2],
		[1.98, { transform: `translateX(${HOVER.x + 5}%)` }, E.inOutSine],
		[2.06, { transform: `translateX(${HOVER.x}%)` }, E.inOut],
		[2.18, { transform: `translateX(${HOVER.x - 8}%)` }, E.outBack], // rears back
		[2.28, { transform: `translateX(${HOVER.x + 2}%)` }, E.inOutSine], // lunges as it breathes
		[2.4, { transform: `translateX(${HOVER.x}%)` }],
		[SETTLE, { transform: `translateX(${HOVER.x}%)` }, E.out],
		[3.88, { transform: "translateX(0)" }],
	]);
	seq(q("[data-frc-dragon-y]"), [
		[1.6, { transform: "translateY(70%)" }, E.outSine],
		[1.82, { transform: "translateY(-75%)" }, E.inOutSine],
		[2.06, { transform: `translateY(${HOVER.y}%)` }, E.inOut],
		[2.18, { transform: `translateY(${HOVER.y - 4}%)` }, E.outBack],
		[2.28, { transform: `translateY(${HOVER.y + 1}%)` }, E.inOutSine],
		[2.4, { transform: `translateY(${HOVER.y}%)` }],
		[SETTLE, { transform: `translateY(${HOVER.y}%)` }, E.out],
		[3.88, { transform: "translateY(0)" }],
	]);
	const pose = (k: number, r: number) => ({ transform: `scale(${k}) rotate(${r}deg)` });
	seq(q("[data-frc-dragon-pose]"), [
		[1.6, pose(K, -10), E.inOutSine],
		[1.82, pose(K, 8), E.inOutSine],
		[2.06, pose(K, 0), E.inOut],
		[2.18, pose(K * 1.09, -11), E.outBack], // wind-up: bigger, head back
		[2.28, pose(K * 1.02, 4), E.inOutSine],
		[2.4, pose(K, 0)],
		[SETTLE, pose(K, 0), E.outBackSoft],
		[3.88, pose(1, 0)],
	]);
	// Wing-flap wobble while it flies, then a slight bob while it breathes.
	const flap = (r: number, sy = 1) => ({ transform: `rotate(${r}deg) scale(1, ${sy})` });
	const flapSteps: Step[] = [];
	for (let i = 0; i < 4; i++) {
		const t = 1.6 + i * 0.11;
		flapSteps.push([t, flap(0), E.inOutSine], [t + 0.0275, flap(-6, 0.93), E.inOutSine], [t + 0.055, flap(0), E.inOutSine], [t + 0.0825, flap(6, 1.05), E.inOutSine]);
	}
	flapSteps.push([2.04, flap(0), E.inOutSine], [2.4, flap(0), E.inOutSine]);
	for (let t = 2.55, s = 1; t < 3.4; t += 0.15, s = -s) flapSteps.push([t, flap(1.3 * s), E.inOutSine]);
	flapSteps.push([3.5, flap(0)]);
	seq(q("[data-frc-dragon-flap]"), flapSteps);

	/* ---------- 3. The long breath of fire and the colour burn (2.2–3.6 s) ---------- */
	const rnd = random(20260927);
	const flicker = (t0: number, t1: number, dt: number, lo: number, hi: number) => {
		const out: Step[] = [];
		for (let t = t0; t < t1; t += dt) out.push([t, { opacity: lo + (hi - lo) * rnd() }, E.inOutSine]);
		return out;
	};
	// Firelight on the dragon, and its own flame flaring.
	seq(q("[data-frc-dragon-glow]"), [[FIRE_START, { opacity: 0 }, E.out], ...flicker(2.32, 3.38, 0.09, 0.7, 1), [3.4, { opacity: 0.9 }, E.inOut], [3.62, { opacity: 0 }]]);
	const flameSteps: Step[] = [[FIRE_START - 0.02, { transform: "scale(1)" }, E.out]];
	for (let t = 2.3; t < 3.38; t += 0.12) flameSteps.push([t, { transform: `scale(${(1.28 + 0.16 * rnd()).toFixed(3)})` }, E.inOutSine]);
	flameSteps.push([3.52, { transform: "scale(1)" }]);
	seq(q("#fb-flame"), flameSteps);

	// The burn: every window slides with the front while its content slides back (src/lib/frc-burn.ts).
	const W = g0.first.w; // the FIRST logo's own (untransformed) size inside the lockup
	const Hl = g0.first.h;
	const frontSteps = (sign: 1 | -1): Step[] => {
		const at = (t: number) => ({ transform: `translate(${(sign * frontX(t) * W).toFixed(2)}px, ${(sign * frontY(t) * Hl).toFixed(2)}px)` });
		const steps: Step[] = [[0, at(0)]];
		for (let t = SWEEP_START - 0.04; t <= SWEEP_END + FRONT_LAG + 0.06; t += 0.04) steps.push([t, at(t)]);
		return steps;
	};
	el.querySelectorAll("[data-frc-burn]").forEach((w) => seq(w, frontSteps(1)));
	el.querySelectorAll("[data-frc-burn-in]").forEach((w) => seq(w, frontSteps(-1)));
	for (const sel of [".frc-burn-char", ".frc-burn-ember", ".frc-burn-hot"]) {
		seq(q(sel), [
			[FIRE_START + 0.02, { opacity: 0 }, E.out],
			[2.3, { opacity: 1 }],
			[3.36, { opacity: 1 }, E.inOut],
			[3.6, { opacity: 0 }],
		]);
	}

	// A small camera shake while the fire is strongest (2–4 px), and a slight heat shimmer on the logo.
	const amp = vw < 600 ? 2 : 3;
	const shake: Step[] = [[2.26, { transform: "translate(0px, 0px)" }]];
	for (let t = 2.3; t < 3.36; t += 0.045) {
		const a = amp * sine((t - 2.26) / 0.14) * (1 - sine((t - 3.18) / 0.18));
		shake.push([t, { transform: `translate(${((rnd() * 2 - 1) * a).toFixed(2)}px, ${((rnd() * 2 - 1) * a).toFixed(2)}px)` }, E.inOutSine]);
	}
	shake.push([3.4, { transform: "translate(0px, 0px)" }]);
	seq(q(".splash-stage"), shake);
	const shimmer: Step[] = [[2.26, { transform: "none" }]];
	for (let t = 2.32; t < 3.44; t += 0.06) {
		const a = intensity(t);
		shimmer.push([t, { transform: `skewX(${((rnd() - 0.5) * 1.2 * a).toFixed(3)}deg) scale(${(1 + (rnd() - 0.5) * 0.012 * a).toFixed(4)}, ${(1 + (rnd() - 0.5) * 0.02 * a).toFixed(4)})` }, E.inOutSine]);
	}
	shimmer.push([3.5, { transform: "none" }]);
	seq(q("[data-frc-first]"), shimmer);

	const canvas = q<HTMLCanvasElement>("[data-frc-fire]");
	const clock = tween(canvas, [{ opacity: 1 }, { opacity: 1 }], 0, SMOKE_END, "linear"); // the fire reads this clock
	let fire: ReturnType<typeof startFire> | undefined;
	if (canvas && clock) {
		// Mouth: the tip of the dragon's own flame (x 655, y 330 of 764) at the hover pose.
		const mouth = { x: badgeLeft + (0.5 + (655 / 764 - 0.5) * K + HOVER.x / 100) * B, y: badgeTop + (0.5 + (330 / 764 - 0.5) * K + HOVER.y / 100) * B };
		fire = startFire(ctx, canvas, clock, mouth, logo);
	}

	/* ---------- 4. Smoke clears; everything is black and white (3.6–4.0 s) ---------- */
	// The dragon settles into its badge (above), which forms around it.
	seq(q(".frc-disc"), [
		[SETTLE + 0.02, { opacity: 0, transform: "scale(0.55)" }, E.outBack],
		[3.76, { opacity: 1, transform: "scale(1)" }],
	]);
	fade(q(".frc-gear"), 3.66, 3.8, 0, 1, E.out);
	// The real artwork takes over: the official white FIRST logo (under the burnt white copy, identical), then the badge.
	const [badgeImg, firstImg] = el.querySelectorAll(".frc-real");
	fade(firstImg, 3.66, 3.82);
	seq(q(".frc-burn-mono"), [
		[FIRE_START, { opacity: 0 }, E.out],
		[FIRE_START + 0.04, { opacity: 1 }],
		[3.82, { opacity: 1 }, E.inOut],
		[3.9, { opacity: 0 }],
	]);
	fade(badgeImg, 3.78, 3.92);
	fade(q("[data-frc-badge-layers]"), 3.9, 3.98, 1, 0);
	fade(q("[data-frc-first-layers]"), 3.88, 3.94, 1, 0);
	seq(q(".frc-divider"), [
		[3.7, { opacity: 1, transform: "scaleY(0)" }, E.out],
		[3.96, { opacity: 1, transform: "scaleY(1)" }],
	]);
	seq(q(".frc-caption"), [
		[3.78, { opacity: 0, transform: "translateY(8px)" }, E.out],
		[4.04, { opacity: 1, transform: "translateY(0)" }],
	]);

	/* ---------- 5. Into the header (4.0–4.8 s) ---------- */
	fade(q("[data-splash-bg]"), 4.12, 4.64, 1, 0, E.out);
	fade(q("[data-splash-skip]"), 3.92, 4.2, 1, 0, E.out);
	ctx.at(4.12, () => root.classList.add("splash-leaving"));
	tween(lockup, [{ opacity: 1 }, { opacity: 0 }], LAND - 0.02, END - LAND + 0.02, E.inOut);
	ctx.endWith(tween(page, [{ opacity: 0 }, { opacity: 1 }], LAND - 0.02, END - LAND + 0.02, E.inOut));

	ctx.devExtras({ retarget, kBig, kFinal, fireQuality: (qy: number) => fire?.setQuality(qy) });
}

/* ---------- The fire ---------- */

type Point = { x: number; y: number };
type Rect = { L: number; T: number; W: number; H: number };

/** Colour ramp from the hot core out to the cooling edges: [heat, r, g, b]. */
const RAMP: Array<[number, number, number, number]> = [
	[0, 255, 250, 228],
	[0.16, 255, 222, 128],
	[0.32, 255, 170, 60],
	[0.5, 255, 116, 30],
	[0.66, 232, 70, 22],
	[0.82, 170, 34, 16],
	[1, 92, 18, 12],
];
const rampAt = (h: number): [number, number, number] => {
	let i = 1;
	while (i < RAMP.length - 1 && RAMP[i][0] < h) i++;
	const [h0, r0, g0, b0] = RAMP[i - 1];
	const [h1, r1, g1, b1] = RAMP[i];
	const f = clamp01((h - h0) / (h1 - h0));
	return [Math.round(r0 + (r1 - r0) * f), Math.round(g0 + (g1 - g0) * f), Math.round(b0 + (b1 - b0) * f)];
};

/** A soft round sprite in one colour (drawn scaled, which is much cheaper than a gradient per particle). */
function sprite([r, g, b]: [number, number, number], mid = 0.5) {
	const s = document.createElement("canvas");
	s.width = s.height = 64;
	const c = s.getContext("2d")!;
	const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
	grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
	grad.addColorStop(0.4, `rgba(${r},${g},${b},${mid})`);
	grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
	c.fillStyle = grad;
	c.fillRect(0, 0, 64, 64);
	return s;
}

/**
 * The fire: one long flame stream from the dragon's mouth that follows the sweep across the logo, plus
 * firelight, embers, sparks and, as it dies down, smoke. Every particle's path is a function of time (seeded),
 * so it plays the same way every time and can be scrubbed in development. Particle counts are capped and
 * drop automatically if the device can't keep up; once the smoke has cleared the loop stops and the canvas
 * and particles are freed.
 */
function startFire(ctx: SplashContext, canvas: HTMLCanvasElement, clock: Animation, mouth: Point, logo: Rect) {
	const c = canvas.getContext("2d");
	if (!c) return undefined;
	const coarse = matchMedia("(pointer: coarse)").matches;
	const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5);
	canvas.width = Math.round(innerWidth * dpr);
	canvas.height = Math.round(innerHeight * dpr);
	c.setTransform(dpr, 0, 0, dpr, 0, 0);
	const S = logo.H; // the unit of size: the logo's height on screen
	const rnd = random(10951);
	const hitAt = (t: number): Point => ({ x: logo.L + aimX(t) * logo.W, y: logo.T + logo.H / 2 + aimY(t) * logo.H });

	// Flame: emitted steadily while breathing (thinned by intensity), each aimed where the hit point will be
	// when it gets there.
	type Flame = { t0: number; life: number; cos: number; sin: number; D: number; side: number; r0: number; ph: number; spin: number; q: number };
	let flame: Flame[] = [];
	const FLAME_N = 600;
	for (let i = 0; i < FLAME_N; i++) {
		const t0 = FIRE_START + ((i + rnd()) / FLAME_N) * (FIRE_STOP - FIRE_START);
		const keep = rnd();
		const I = intensity(t0);
		const life = (0.36 + 0.2 * rnd()) * (0.75 + 0.25 * I);
		const hit = hitAt(t0 + 0.4 * life);
		const ax = hit.x + (rnd() - 0.5) * 0.25 * S;
		const ay = hit.y + (rnd() - 0.5) * 0.3 * S;
		const side = rnd() + rnd() - 1;
		const r0 = 0.7 + 0.6 * rnd();
		const ph = rnd() * 6.283;
		const spin = 7 + 6 * rnd();
		const q = rnd();
		if (keep > I) continue;
		const dx = ax - mouth.x;
		const dy = ay - mouth.y;
		const D = Math.hypot(dx, dy) || 1;
		flame.push({ t0, life, cos: dx / D, sin: dy / D, D, side, r0, ph, spin, q });
	}
	// Embers: rise and flicker off the hit point, some lingering after the flame.
	type Ember = { t0: number; life: number; x: number; y: number; vx: number; vy: number; size: number; ph: number; q: number };
	let embers: Ember[] = [];
	for (let i = 0; i < 110; i++) {
		const t0 = FIRE_START + 0.1 + rnd() * (FIRE_STOP - FIRE_START);
		const hit = hitAt(t0);
		embers.push({
			t0,
			life: Math.min(0.45 + 0.6 * rnd(), SMOKE_END - t0 - 0.02),
			x: hit.x + (rnd() - 0.5) * 0.6 * S,
			y: hit.y + (rnd() - 0.5) * 0.6 * S,
			vx: (rnd() - 0.3) * 1.1 * S,
			vy: -(0.5 + 1.2 * rnd()) * S,
			size: Math.max(1, (0.012 + 0.016 * rnd()) * S),
			ph: rnd() * 6.283,
			q: rnd(),
		});
	}
	// Sparks: quick bright streaks thrown forward from the hit point.
	type Spark = { t0: number; life: number; x: number; y: number; vx: number; vy: number; q: number };
	let sparks: Spark[] = [];
	for (let i = 0; i < 60; i++) {
		const t0 = SWEEP_START + rnd() * (FIRE_STOP - SWEEP_START - 0.1);
		const hit = hitAt(t0);
		const a = Math.atan2(hit.y - mouth.y, hit.x - mouth.x) + (rnd() - 0.5) * 2.2;
		const v = (2.2 + 1.8 * rnd()) * S;
		sparks.push({ t0, life: 0.18 + 0.18 * rnd(), x: hit.x, y: hit.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6 * S, q: rnd() });
	}
	// Smoke: drifts up off the burnt logo (and from the dragon's mouth) as the fire dies.
	type Puff = { t0: number; life: number; x: number; y: number; vx: number; vy: number; r0: number };
	let smoke: Puff[] = [];
	for (let i = 0; i < 48; i++) {
		const fromMouth = i < 8;
		const t0 = fromMouth ? 3.3 + rnd() * 0.25 : 3.14 + rnd() * 0.46;
		smoke.push({
			t0,
			life: Math.min(0.42 + 0.3 * rnd(), SMOKE_END - t0 - 0.02),
			x: fromMouth ? mouth.x + (rnd() - 0.3) * 0.4 * S : logo.L + rnd() * logo.W,
			y: fromMouth ? mouth.y + (rnd() - 0.5) * 0.3 * S : logo.T + logo.H * 0.45 * rnd(),
			vx: (0.05 + 0.25 * rnd()) * S,
			vy: -(0.45 + 0.4 * rnd()) * S,
			r0: 0.8 + 0.4 * rnd(),
		});
	}

	const HEAT_LEVELS = 12;
	const CORE_N = 44;
	const flameSprites = Array.from({ length: HEAT_LEVELS }, (_, i) => sprite(rampAt(i / (HEAT_LEVELS - 1))));
	const emberSprite = sprite([255, 196, 110], 0.35);
	const smokeSprite = sprite([62, 68, 88], 0.55);

	let quality = coarse ? 0.75 : 1; // share of particles drawn; lowered automatically if frames run long
	let locked = false;

	const draw = (t: number) => {
		c.clearRect(0, 0, innerWidth, innerHeight);
		const grow = 1 + (1 - quality) * 0.5; // fewer particles: slightly bigger ones, so the flame stays full
		// Smoke, under the fire.
		c.globalCompositeOperation = "source-over";
		for (const p of smoke) {
			const tau = t - p.t0;
			if (tau < 0 || tau > p.life) continue;
			const a = tau / p.life;
			const r = S * (0.22 + 0.55 * a) * p.r0;
			c.globalAlpha = 0.15 * Math.pow(Math.sin(Math.PI * a), 0.8);
			c.drawImage(smokeSprite, p.x + p.vx * tau - r, p.y + p.vy * tau - r, 2 * r, 2 * r);
		}
		// Flame: the cooler, deep-red edges are painted normally; the hot core adds light.
		const I = intensity(t);
		for (const pass of [0, 1]) {
			c.globalCompositeOperation = pass ? "lighter" : "source-over";
			if (pass && I > 0.01) {
				// Firelight on the background around the hit point and the mouth.
				const hit = hitAt(t);
				const fl = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 23);
				for (const [p, R, k] of [
					[hit, 2.4 * S, 0.26],
					[mouth, 1.1 * S, 0.2],
				] as const) {
					const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
					g.addColorStop(0, `rgba(255,130,50,${(k * I * fl).toFixed(3)})`);
					g.addColorStop(0.5, `rgba(255,90,30,${(0.4 * k * I * fl).toFixed(3)})`);
					g.addColorStop(1, "rgba(255,80,20,0)");
					c.globalAlpha = 1;
					c.fillStyle = g;
					c.fillRect(p.x - R, p.y - R, 2 * R, 2 * R);
				}
			}
			if (pass && I > 0.01) {
				// The stream's continuous core: the path a flame particle would be on if it left the mouth at each
				// moment of the last half second (so it curves like a hose as the aim sweeps).
				const life = 0.46 * (0.75 + 0.25 * I);
				for (let k = 0; k < CORE_N; k++) {
					const s = (k / (CORE_N - 1)) * 1.2; // distance along, in units of the distance to that moment's hit point
					const a = 1 - Math.cbrt(1 - 0.784 * s); // the age at which a particle gets that far
					const te = t - a * life;
					const Ie = intensity(te);
					if (Ie < 0.02) continue;
					const hit = hitAt(te + 0.4 * life);
					const dx = hit.x - mouth.x;
					const dy = hit.y - mouth.y;
					const D = Math.hypot(dx, dy) || 1;
					const wob = S * 0.06 * a * Math.sin(t * 19 + k * 0.8);
					const x = mouth.x + dx * s - (dy / D) * wob;
					const y = mouth.y + dy * s + (dx / D) * wob - 0.9 * S * (a * life) ** 2;
					const r = S * (0.13 + 0.42 * Math.pow(a, 0.7));
					c.globalAlpha = 0.4 * Math.pow(1 - a, 0.5) * Ie;
					c.drawImage(flameSprites[Math.round((0.1 + 0.75 * a) * (HEAT_LEVELS - 1))], x - r, y - r, 2 * r, 2 * r);
				}
			}
			for (const p of flame) {
				if (p.q > quality) continue;
				const tau = t - p.t0;
				if (tau < 0 || tau > p.life) continue;
				const a = tau / p.life;
				const heat = Math.min(1, 0.08 + a * (1 + 0.8 * Math.abs(p.side)));
				if (heat >= 0.62 === (pass === 1)) continue;
				const along = (p.D * (1 - Math.pow(1 - a, 3))) / 0.784; // reaches the hit point at 40 % of its life
				const perp = p.side * S * (0.1 + 0.75 * Math.pow(a, 1.1)) + S * 0.14 * a * Math.sin(tau * p.spin + p.ph + t * 3); // spreads, and churns
				const x = mouth.x + p.cos * along - p.sin * perp;
				const y = mouth.y + p.sin * along + p.cos * perp - 0.9 * S * tau * tau; // hot air rises
				const r = S * (0.13 + 0.42 * Math.pow(a, 0.75)) * p.r0 * grow;
				c.globalAlpha = Math.pow(1 - a, 0.8) * (0.8 + 0.2 * Math.sin(tau * 45 + p.ph)) * (pass ? 0.45 : 0.7);
				c.drawImage(flameSprites[Math.round(heat * (HEAT_LEVELS - 1))], x - r, y - r, 2 * r, 2 * r);
			}
		}
		// Embers and sparks.
		for (const p of embers) {
			if (p.q > quality) continue;
			const tau = t - p.t0;
			if (tau < 0 || tau > p.life) continue;
			const a = tau / p.life;
			const x = p.x + p.vx * tau + 0.06 * S * Math.sin(tau * 8 + p.ph);
			const y = p.y + p.vy * tau * (1 - 0.35 * tau);
			const r = p.size * 2.2;
			c.globalAlpha = Math.pow(1 - a, 1.2) * (Math.sin(tau * 30 + p.ph) > 0 ? 1 : 0.45);
			c.drawImage(emberSprite, x - r, y - r, 2 * r, 2 * r);
		}
		c.lineCap = "round";
		c.lineWidth = Math.max(1, 0.012 * S);
		c.strokeStyle = "rgb(255,226,150)";
		for (const p of sparks) {
			if (p.q > quality) continue;
			const tau = t - p.t0;
			if (tau < 0 || tau > p.life) continue;
			const tail = Math.max(0, tau - 0.035);
			c.globalAlpha = 1 - tau / p.life;
			c.beginPath();
			c.moveTo(p.x + p.vx * tail, p.y + p.vy * tail + 1.6 * S * tail * tail);
			c.lineTo(p.x + p.vx * tau, p.y + p.vy * tau + 1.6 * S * tau * tau);
			c.stroke();
		}
		c.globalAlpha = 1;
		c.globalCompositeOperation = "source-over";
	};

	let raf = 0;
	let last = 0;
	let frames = 0;
	let avg = 1000 / 60;
	let dirty = false;
	const free = () => {
		cancelAnimationFrame(raf);
		flame = [];
		embers = [];
		sparks = [];
		smoke = [];
		canvas.width = canvas.height = 0; // releases the canvas memory
		canvas.remove();
	};
	const tick = (now: number) => {
		const t = Number(clock.currentTime ?? 0) / 1000;
		const paused = clock.playState === "paused"; // a dev screenshot
		// Watch the real frame time from the start, so a slow device is caught before the fire: if frames run
		// long, draw fewer particles.
		if (!paused && last) {
			avg = avg * 0.9 + (now - last) * 0.1;
			if (++frames % 15 === 0 && !locked && t < FIRE_STOP && avg > 21) quality = Math.max(0.35, quality * 0.8);
		}
		last = now;
		if (t >= FIRE_START - 0.02 && t <= SMOKE_END) {
			draw(t);
			dirty = true;
		} else if (dirty) {
			c.clearRect(0, 0, innerWidth, innerHeight);
			dirty = false;
		}
		if (t > SMOKE_END && !paused) return free();
		raf = requestAnimationFrame(tick);
	};
	raf = requestAnimationFrame(tick);
	ctx.onCleanup(free);
	return {
		/** Dev: fix the share of particles drawn (e.g. 1 for screenshots). */
		setQuality(qy: number) {
			quality = qy;
			locked = true;
		},
	};
}

// On a real page load the overlay is already up when this runs. On an in-site arrival SplashShell puts it up
// during the page swap: the first time, that swap is also what loads this script (so the call below starts it);
// after that the script has already run, and the router's after-swap event starts it instead.
const start = () => runSplash("frc", play, { fastRate: FAST_RATE });
start();
document.addEventListener("astro:after-swap", start);

export {};
