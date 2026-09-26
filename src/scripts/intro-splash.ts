/**
 * Animated logo intro, about 3.2 s, "build then boot". Markup and CSS: src/components/IntroSplash.astro.
 *
 *   0.0–1.0  the wrench swings in from the left on an arc (stretched while it's fast), overshoots,
 *            tightens a quarter-turn with a small bounce and settles. It enters silver and turns teal
 *            as the screen lights up behind it, so it never disappears into the navy.
 *   1.0–1.8  boot: the ring draws itself round, the monitor outline draws on and fills, the screen
 *            flickers on with a soft cyan glow, the signal waves pulse out from the wrench, inner to outer.
 *   1.8–2.6  type-on: J P L, a short pause, I N N O V A T I O N, with a cyan cursor that blinks twice.
 *   2.6–3.3  a light sweep, then the logo flies into the navbar logo (FLIP) while the overlay fades.
 *
 * Web Animations API only, no library: every animation is transform, opacity or stroke-dashoffset on a
 * custom cubic-bezier. All of them are created at once on one clock, so Skip just finishes them all, and in
 * development the whole timeline can be frozen at any moment with window.__intro.seek(seconds).
 */

type Frames = Keyframe[];

const root = document.documentElement;
const splash = document.querySelector<HTMLElement>("[data-intro]");

/** Ease curves (the GSAP equivalents in the comments). Nothing is linear. */
const E = {
	out: "cubic-bezier(0.25, 1, 0.5, 1)", // power3.out
	outExpo: "cubic-bezier(0.16, 1, 0.3, 1)", // expo.out
	outBack: "cubic-bezier(0.34, 1.56, 0.64, 1)", // back.out(1.7)
	outBackSoft: "cubic-bezier(0.3, 1.35, 0.5, 1)", // back.out(1.2)
	inOut: "cubic-bezier(0.65, 0, 0.35, 1)", // power2.inOut
	inOutSine: "cubic-bezier(0.37, 0, 0.63, 1)", // sine.inOut
	outSine: "cubic-bezier(0.61, 1, 0.88, 1)", // sine.out
	out2: "cubic-bezier(0.33, 1, 0.68, 1)", // power2.out
	in: "cubic-bezier(0.32, 0, 0.67, 0)", // power2.in
	fly: "cubic-bezier(0.7, 0, 0.18, 1)", // strong in-out for the hand-off
};

/** Timeline marks, in seconds. */
const FLY = 2.74; // the logo starts flying to the navbar
const LAND = 3.14; // ...and lands
const END = 3.28; // crossfade into the real navbar logo done

const anims: Animation[] = [];
let finished = false;

/** Add one animation to the timeline: `frames` over [start, start + dur] seconds. */
function tween(el: Element | null | undefined, frames: Frames, start: number, dur: number, easing = E.out) {
	if (!el) return undefined;
	const a = el.animate(frames, { delay: start * 1000, duration: dur * 1000, easing, fill: "both" });
	anims.push(a);
	return a;
}

function markDone() {
	try {
		sessionStorage.setItem("jpl-intro", "done");
	} catch {
		/* private mode: it will simply play again next session */
	}
}

/** The navbar logo that's showing (light or dark variant). */
function navLogo() {
	const wrap = document.querySelector<HTMLElement>("[data-site-header] [data-site-logo]");
	const img = wrap && [...wrap.querySelectorAll("img")].find((i) => i.getClientRects().length > 0);
	return { wrap, img };
}

function start(el: HTMLElement) {
	root.classList.add("intro-live"); // cancels the CSS failsafe
	markDone();

	const svg = el.querySelector<SVGSVGElement>("svg.jl-logo")!;
	// Searches the whole splash: the wrench group gets lifted out of the main SVG into its own layer.
	const $ = (id: string) => el.querySelector<SVGGraphicsElement>(`#jl-${id}`);
	const logo = el.querySelector<HTMLElement>("[data-intro-logo]")!;
	const parallax = el.querySelector<HTMLElement>("[data-intro-parallax]")!;
	const bg = el.querySelector<HTMLElement>("[data-intro-bg]");
	const skipButton = el.querySelector<HTMLElement>("[data-intro-skip]");
	const { wrap: navWrap } = navLogo();

	/* ---------- Reduced motion: no movement, just a quick 300 ms fade ---------- */
	if (root.classList.contains("intro-reduced")) {
		tween(el, [{ opacity: 1 }, { opacity: 0 }], 0.35, 0.3, E.out)!.finished.then(cleanup, () => {});
		wireSkip(el);
		return;
	}

	/* ---------- 1. Wrench (0.0–1.0 s) ---------- */
	// It flies while the page underneath is still starting up (layout, hydration, image decoding), so it
	// moves on the compositor: the wrench group is lifted into its own small SVG stacked exactly over the
	// logo, wrapped in HTML layers (x, y, stretch, spin, squash), each animating transform only.
	// x sweeps in (power2 out) while y rises to a crest and drops in, which bends the path into an arc.
	const wrench = liftWrench(svg, parallax);
	tween(wrench.x, [{ opacity: 0 }, { opacity: 1 }], 0, 0.14, E.out);
	tween(
		wrench.x,
		[
			{ transform: `translateX(${pctX(-900)})`, easing: E.out2 },
			{ transform: `translateX(${pctX(26)})`, offset: 0.72, easing: E.inOutSine }, // overshoot past its slot
			{ transform: "translateX(0)" },
		],
		0,
		0.8,
		"linear",
	);
	tween(
		wrench.y,
		[
			{ transform: `translateY(${pctY(170)})`, easing: E.outSine },
			{ transform: `translateY(${pctY(-64)})`, offset: 0.34, easing: E.inOutSine },
			{ transform: "translateY(0)" },
		],
		0,
		0.62,
		"linear",
	);
	// Motion-blur feel: stretched along its path while it's fast, relaxing as it slows.
	tween(wrench.stretch, [{ transform: "scale(1.5, 0.78)" }, { transform: "scale(1, 1)" }], 0, 0.5, E.out);
	// Spins in, grips at -90° for a beat, then a clockwise quarter-turn "tighten" that overshoots and settles.
	tween(
		wrench.spin,
		[
			{ transform: "rotate(-165deg)", easing: E.out },
			{ transform: "rotate(-90deg)", offset: 0.55 },
			{ transform: "rotate(-90deg)", offset: 0.6, easing: E.outBack },
			{ transform: "rotate(0deg)" },
		],
		0,
		1.0,
		"linear",
	);
	// A small squash-and-bounce as it bites.
	tween(
		wrench.squash,
		[
			{ transform: "scale(1)" },
			{ transform: "scale(0.93)", offset: 0.35, easing: E.outBack },
			{ transform: "scale(1)" },
		],
		0.8,
		0.26,
		E.inOutSine,
	);
	// Silver while flying; turns teal as the screen lights up behind it.
	tween($("wrench-metal"), [{ opacity: 1 }, { opacity: 0 }], 1.38, 0.34, E.inOut);

	/* ---------- 2. Boot (1.0–1.8 s) ---------- */
	tween($("badge-fill"), [{ opacity: 0, scale: "0.9" }, { opacity: 1, scale: "1" }], 1.0, 0.45, E.outExpo);
	for (const id of ["ring-rim", "ring"]) {
		tween(
			$(id),
			[
				{ opacity: 0, strokeDashoffset: 1 },
				{ opacity: 1, strokeDashoffset: 0.94, offset: 0.06 },
				{ opacity: 1, strokeDashoffset: 0 },
			],
			1.02,
			0.56,
			E.inOut,
		);
	}
	// Monitor: the outlines draw on, the solid shapes fill in behind them, then the outlines fade.
	for (const [line, fill, t] of [
		["bezel-line", "bezel", 1.1],
		["frame-line", "frame", 1.16],
	] as const) {
		tween(
			$(line),
			[
				{ opacity: 1, strokeDashoffset: 1, easing: E.inOut },
				{ opacity: 1, strokeDashoffset: 0, offset: 0.68, easing: E.out },
				{ opacity: 0, strokeDashoffset: 0 },
			],
			t,
			0.62,
			"linear",
		);
		tween($(fill), [{ opacity: 0 }, { opacity: 1 }], t + 0.28, 0.24, E.out);
	}
	svg.querySelectorAll(".jl-stand").forEach((part, i) => {
		tween(part, [{ opacity: 0, translate: "0 10px" }, { opacity: 1, translate: "0 0" }], 1.3 + i * 0.035, 0.42, E.outExpo);
	});
	// Screen flickers on: 0 → 60 → 20 → 100 %.
	tween(
		$("screen"),
		[
			{ opacity: 0, easing: E.outExpo },
			{ opacity: 0.6, offset: 0.28, easing: E.in },
			{ opacity: 0.2, offset: 0.5, easing: E.outExpo },
			{ opacity: 1 },
		],
		1.42,
		0.3,
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
		1.42,
		0.85,
		"linear",
	);
	// Signal waves pulse out from the wrench head, inner pair first.
	(
		[
			["wave-l1", "wave-r1"],
			["wave-l2", "wave-r2"],
			["wave-l3", "wave-r3"],
		] as const
	).forEach((pair, k) => {
		for (const id of pair) {
			tween(
				$(id),
				[
					{ opacity: 0, scale: "0.4", easing: E.outExpo },
					{ opacity: 1, scale: "1.08", offset: 0.55, easing: E.inOutSine },
					{ opacity: 1, scale: "1" },
				],
				1.58 + k * 0.085,
				0.42,
				"linear",
			);
		}
	});

	/* ---------- 3. Type-on (1.8–2.6 s) ---------- */
	const letterIds = ["J", "P", "L", "I1", "N1", "N2", "O1", "V", "A", "T", "I2", "O2", "N3"];
	const letterStart = (k: number) => (k < 3 ? 1.8 + k * 0.05 : 2.04 + (k - 3) * 0.045);
	const boxes = letterIds.map((id) => $(id)!.getBBox());
	letterIds.forEach((id, k) => {
		tween(
			$(id),
			[
				{ opacity: 0, translate: "0 14px", scale: "0.8" },
				{ opacity: 1, translate: "0 0", scale: "1" },
			],
			letterStart(k),
			0.34,
			E.outBackSoft,
		);
	});
	// Cursor: glides to just after each new letter, blinks twice after the last one, then fades.
	const cursor = $("cursor");
	if (cursor) {
		const top = Math.min(...boxes.map((b) => b.y));
		const bottom = Math.max(...boxes.map((b) => b.y + b.height));
		cursor.setAttribute("y", String(top));
		cursor.setAttribute("height", String(bottom - top));
		cursor.setAttribute("width", "2.6");
		const x = (k: number) => `${boxes[k].x + boxes[k].width + 6}px 0`;
		const t0 = 1.74;
		const t1 = 2.84;
		const off = (t: number) => (t - t0) / (t1 - t0);
		const glide: Frames = [{ translate: `${boxes[0].x - 8}px 0`, offset: 0, easing: E.out }];
		letterIds.forEach((_, k) => glide.push({ translate: x(k), offset: off(letterStart(k) + 0.06), easing: E.out }));
		glide.push({ translate: x(letterIds.length - 1), offset: 1 });
		tween(cursor, glide, t0, t1 - t0, "linear");
		const blink: Array<[number, number]> = [
			[1.74, 0],
			[1.8, 1],
			[2.5, 1],
			[2.54, 0],
			[2.6, 1],
			[2.66, 0],
			[2.72, 1],
			[2.84, 0],
		];
		tween(
			cursor,
			blink.map(([t, o]) => ({ opacity: o, offset: off(t), easing: E.inOut })),
			t0,
			t1 - t0,
			"linear",
		);
	}

	/* ---------- 4. Hand-off (2.46–3.28 s) ---------- */
	tween(
		$("sweep"),
		[
			{ opacity: 0, translate: "0 0" },
			{ opacity: 1, translate: "100px 0", offset: 0.08 },
			{ opacity: 1, translate: "900px 0", offset: 0.92 },
			{ opacity: 0, translate: "980px 0" },
		],
		2.46,
		0.4,
		E.inOut,
	);
	// FLIP into the navbar logo. Measured now, and again just before take-off (fonts or the scrollbar can
	// nudge the header while the intro plays).
	const flight = tween(logo, [{ transform: "none" }, { transform: flightTarget(logo) }], FLY, LAND - FLY, E.fly);
	window.setTimeout(() => {
		// Only while it's genuinely about to take off (not paused, not already moving).
		if (finished || !flight || flight.playState !== "running" || Number(flight.currentTime) >= FLY * 1000) return;
		(flight.effect as KeyframeEffect).setKeyframes([{ transform: "none" }, { transform: flightTarget(logo) }]);
	}, (FLY - 0.06) * 1000);
	tween(bg, [{ opacity: 1 }, { opacity: 0 }], 2.8, LAND - 2.8, E.out);
	window.setTimeout(() => root.classList.add("intro-leaving"), 2800); // scrollbar back to the page's colours
	tween(skipButton, [{ opacity: 1 }, { opacity: 0 }], 2.6, 0.3, E.out);
	if (!root.classList.contains("dark")) {
		// Light theme: the navbar logo has navy "JPL", so the silver letters turn navy on the way.
		tween($("jpl-ink"), [{ opacity: 0 }, { opacity: 1 }], 2.84, 0.28, E.inOut);
	}
	// Crossfade into the real navbar image once they're on top of each other (the PNG has a soft shadow
	// and bevel the flat vectors don't, so this is a blend rather than a swap).
	tween(logo, [{ opacity: 1 }, { opacity: 0 }], LAND - 0.02, END - LAND, E.inOut);
	const reveal = tween(navWrap, [{ opacity: 0 }, { opacity: 1 }], LAND - 0.02, END - LAND, E.inOut);
	(reveal ?? anims[anims.length - 1]).finished.then(cleanup, () => {});

	startParallax(parallax);
	wireSkip(el);

	if (import.meta.env.DEV) {
		// Freeze the timeline at any moment for screenshots: __intro.seek(1.2)
		(window as unknown as { __intro: object }).__intro = {
			anims,
			seek(t: number) {
				for (const a of anims) {
					a.pause();
					a.currentTime = t * 1000;
				}
			},
			retarget: () => (flight?.effect as KeyframeEffect | undefined)?.setKeyframes([{ transform: "none" }, { transform: flightTarget(logo) }]),
		};
	}
}

/* ---------- The wrench's own compositor layer ---------- */
const VIEWBOX = { x: 49, y: 40, w: 687, h: 248 };
const PIVOT = { x: 610.5, y: 147.5 }; // wrench head centre, in logo pixels (see data-pivot in the SVG)
/** Logo pixels as a percentage of the layer's own width / height (so it scales with the logo). */
const pctX = (px: number) => `${((px / VIEWBOX.w) * 100).toFixed(3)}%`;
const pctY = (px: number) => `${((px / VIEWBOX.h) * 100).toFixed(3)}%`;

function liftWrench(svg: SVGSVGElement, host: HTMLElement) {
	const layer = (cls: string, parent: Element) => {
		const el = document.createElement("div");
		el.className = `jl-wlayer ${cls}`;
		parent.appendChild(el);
		return el;
	};
	const x = layer("jl-wx", host);
	const y = layer("jl-wy", x);
	const stretch = layer("jl-wpivot", y);
	const spin = layer("jl-wpivot", stretch);
	const squash = layer("jl-wpivot", spin);
	const own = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	own.setAttribute("viewBox", svg.getAttribute("viewBox") ?? `${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`);
	own.setAttribute("class", "jl-logo jl-wrench-svg");
	own.setAttribute("aria-hidden", "true");
	const group = svg.querySelector("#jl-wrench-x");
	if (group) {
		group.classList.remove("jl-part"); // visible inside its layer; the layer fades in instead
		own.appendChild(group);
	}
	squash.appendChild(own);
	const origin = `${(((PIVOT.x - VIEWBOX.x) / VIEWBOX.w) * 100).toFixed(3)}% ${(((PIVOT.y - VIEWBOX.y) / VIEWBOX.h) * 100).toFixed(3)}%`;
	for (const el of [stretch, spin, squash]) el.style.transformOrigin = origin;
	return { x, y, stretch, spin, squash };
}

/** Transform (origin: top-left) that puts the splash logo exactly over the navbar logo. */
function flightTarget(logo: HTMLElement) {
	const from = logo.getBoundingClientRect();
	const { img } = navLogo();
	const to = img?.getBoundingClientRect();
	// Header hidden or off-screen (e.g. the page opened scrolled down): shrink away in place instead.
	if (!to || to.width === 0 || to.bottom <= 0 || to.top >= innerHeight) {
		const s = 0.9;
		return `translate(${(from.width * (1 - s)) / 2}px, ${(from.height * (1 - s)) / 2}px) scale(${s})`;
	}
	return `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})`;
}

/* ---------- Parallax (desktop only): the logo leans a little toward the mouse ---------- */
let parallaxRaf = 0;
function startParallax(el: HTMLElement) {
	if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
	const target = { x: 0, y: 0 };
	const cur = { x: 0, y: 0 };
	const t0 = performance.now();
	const onMove = (e: PointerEvent) => {
		if (e.pointerType !== "mouse") return;
		target.x = (e.clientX / innerWidth - 0.5) * 2;
		target.y = (e.clientY / innerHeight - 0.5) * 2;
	};
	addEventListener("pointermove", onMove, { passive: true });
	const frame = (now: number) => {
		const t = (now - t0) / 1000;
		// Glide back to centre before take-off so the flight starts from the true position.
		const settle = t > 2.4;
		const k = settle ? 0.2 : 0.08;
		cur.x += ((settle ? 0 : target.x) - cur.x) * k;
		cur.y += ((settle ? 0 : target.y) - cur.y) * k;
		if (t >= FLY - 0.08) {
			el.style.transform = "";
			removeEventListener("pointermove", onMove);
			return;
		}
		el.style.transform = `translate3d(${cur.x * 10}px, ${cur.y * 8}px, 0) rotateX(${-cur.y * 3}deg) rotateY(${cur.x * 4}deg)`;
		parallaxRaf = requestAnimationFrame(frame);
	};
	parallaxRaf = requestAnimationFrame(frame);
}

/* ---------- Skip: the button, a click or tap anywhere, any key, or a scroll ---------- */
let unwire = () => {};
function wireSkip(el: HTMLElement) {
	const skip = () => {
		for (const a of anims) {
			try {
				a.finish();
			} catch {
				/* already cancelled */
			}
		}
		cleanup();
	};
	const onKey = () => skip(); // Tab still moves focus into the page as usual
	el.addEventListener("pointerdown", skip);
	addEventListener("keydown", onKey, true);
	addEventListener("wheel", skip, { passive: true });
	addEventListener("touchmove", skip, { passive: true });
	unwire = () => {
		el.removeEventListener("pointerdown", skip);
		removeEventListener("keydown", onKey, true);
		removeEventListener("wheel", skip);
		removeEventListener("touchmove", skip);
	};
}

/** End state: overlay gone, navbar logo showing, nothing left running. */
function cleanup() {
	if (finished) return;
	finished = true;
	unwire();
	cancelAnimationFrame(parallaxRaf);
	root.classList.remove("intro", "intro-live", "intro-reduced", "intro-leaving");
	for (const a of anims) a.cancel(); // the navbar logo's own opacity takes over again (1)
	splash?.remove();
}

if (splash && root.classList.contains("intro")) {
	if (performance.now() > 4000) {
		// The script arrived so late that the CSS failsafe is about to hide the overlay: don't start now.
		markDone();
		cleanup();
	} else if (document.hidden) {
		// Opened in a background tab: hold the first frame until the visitor actually looks.
		root.classList.add("intro-live");
		document.addEventListener("visibilitychange", function onVisible() {
			if (document.hidden) return;
			document.removeEventListener("visibilitychange", onVisible);
			start(splash);
		});
	} else {
		start(splash);
	}
} else {
	splash?.remove();
}

export {};
