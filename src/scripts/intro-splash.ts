/**
 * JPL logo intro, "build then boot", 2.8 s. Markup and CSS: src/components/IntroSplash.astro.
 * Shared overlay, skip, reduced motion and clean-up: src/scripts/splash-core.ts.
 *
 *   wrench   the wrench swings in from the left on an arc (stretched while it's fast), overshoots,
 *            tightens a quarter-turn with a small bounce and settles. It enters silver and turns teal
 *            as the screen lights up behind it, so it never disappears into the navy.
 *   boot     the ring draws itself round, the monitor outline draws on and fills, the screen flickers on
 *            with a soft cyan glow, the signal waves pulse out from the wrench, inner to outer.
 *   type-on  J P L, a short pause, I N N O V A T I O N, with a cyan cursor that blinks twice.
 *   slogan   "Sketch it. Build it. Secure it." comes in under the logo.
 *   hold     the opening page: the timeline stops (ctx.hold). A first visit on a computer that could run the 3D is
 *            asked 3D or Classic here (BaseLayout put html.choose-experience on); later visits pause for a beat.
 *   hand-off a light sweep, then the logo flies (FLIP) into the navbar logo, or with 3D on the home page onto the
 *            logo on the studio's wall (src/lib/handoff.ts), while the overlay fades and the page or the room appears.
 *
 * The beats are written on a 3.78 s design clock (plus the hold) and played back SPEED times faster.
 * On a refresh the same timeline plays FAST_RATE times faster again, without the cursor.
 */
import { startStudio, whenLive } from "@/lib/handoff";
import { E, flip, onScreen, runSplash, type Frames, type SplashContext } from "./splash-core";

const SPEED = 3.28 / 2.8;
const FAST_RATE = 2.5;
const s = (t: number) => t / SPEED; // design seconds → real seconds

/** Design-clock marks. */
const HOLD = 2.9; // the opening page: logo and slogan up, the timeline waits here
const FLY = 3.24; // the logo starts flying to the navbar (or the studio's wall)
const LAND = 3.64; // ...and lands
const END = 3.78; // crossfade into the real navbar logo done
/** How long later visits rest on the opening page, in real seconds (full, then fast). */
const BEAT = { full: 0.7, fast: 0.25 };

const root = document.documentElement;

/** The navbar logo that's showing (light or dark variant). */
function navLogo() {
	const wrap = document.querySelector<HTMLElement>("[data-site-header] [data-site-logo]");
	const img = wrap && [...wrap.querySelectorAll("img")].find((i) => i.getClientRects().length > 0);
	return { wrap, img };
}

function play(ctx: SplashContext) {
	const { el } = ctx;
	/** Tween on the design clock. */
	const tween = (target: Element | null | undefined, frames: Frames, start: number, dur: number, easing = E.out) => ctx.tween(target, frames, s(start), s(dur), easing);

	const svg = el.querySelector<SVGSVGElement>("svg.jl-logo")!;
	// Searches the whole splash: the wrench group gets lifted out of the main SVG into its own layer.
	const $ = (id: string) => el.querySelector<SVGGraphicsElement>(`#jl-${id}`);
	const logo = el.querySelector<HTMLElement>("[data-intro-logo]")!;
	const parallax = el.querySelector<HTMLElement>("[data-intro-parallax]")!;
	const bg = el.querySelector<HTMLElement>("[data-splash-bg]");
	const skipButton = el.querySelector<HTMLElement>("[data-splash-skip]");
	const { wrap: navWrap } = navLogo();
	const slogan = el.querySelector<HTMLElement>("[data-intro-slogan]");
	const choice = el.querySelector<HTMLElement>("[data-intro-choice]");
	// The first-visit question is asked here, not in the pop-up (ExperienceChoice.astro), and Skip stays off until it
	// has been answered.
	const asking = root.classList.contains("choose-experience") && !!choice;
	if (asking) {
		root.classList.remove("choose-experience");
		ctx.skippable(false);
	}
	/** Where the logo lands: the navbar logo, unless the studio's wall takes over (3D, home page). */
	let landing = () => navLogo().img?.getBoundingClientRect();

	/* ---------- Wrench (design 0.0–1.0 s) ---------- */
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

	/* ---------- Boot (design 1.0–1.8 s) ---------- */
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

	/* ---------- Type-on (design 1.8–2.6 s) ---------- */
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
	// (Left out of the fast version: its blinks are the slow part.)
	const cursor = ctx.mode === "full" ? $("cursor") : null;
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

	/* ---------- Hand-off (design 2.96–3.78 s) ---------- */
	tween(
		$("sweep"),
		[
			{ opacity: 0, translate: "0 0" },
			{ opacity: 1, translate: "100px 0", offset: 0.08 },
			{ opacity: 1, translate: "900px 0", offset: 0.92 },
			{ opacity: 0, translate: "980px 0" },
		],
		2.96,
		0.4,
		E.inOut,
	);
	// FLIP into the navbar logo. Measured now, and again just before take-off (fonts or the scrollbar can
	// nudge the header while the intro plays).
	const flight = tween(logo, [{ transform: "none" }, { transform: flightTarget(logo, landing()) }], FLY, LAND - FLY, E.fly);
	const retarget = () => (flight?.effect as KeyframeEffect | undefined)?.setKeyframes([{ transform: "none" }, { transform: flightTarget(logo, landing()) }]);
	ctx.at(s(FLY - 0.06), () => {
		// Only while it's genuinely about to take off (not paused, not already moving).
		if (flight && flight.playState === "running" && Number(flight.currentTime) < s(FLY) * 1000) retarget();
	});
	tween(bg, [{ opacity: 1 }, { opacity: 0 }], 3.3, LAND - 3.3, E.out);
	ctx.at(s(3.3), () => root.classList.add("splash-leaving")); // scrollbar back to the page's colours
	tween(skipButton, [{ opacity: 1 }, { opacity: 0 }], 3.1, 0.3, E.out);
	if (!root.classList.contains("dark")) {
		// Light theme: the navbar logo has navy "JPL", so the silver letters turn navy on the way.
		tween($("jpl-ink"), [{ opacity: 0 }, { opacity: 1 }], 3.34, 0.28, E.inOut);
	}

	/* ---------- Slogan, and the opening page's hold (design 2.5-3.45 s, the hold at 2.9) ---------- */
	// One animation for in and out (two on the same element would fight over its opacity before the second starts).
	tween(
		slogan,
		[
			{ opacity: 0, translate: "0 10px", offset: 0 },
			{ opacity: 1, translate: "0 0", offset: 0.4 },
			{ opacity: 1, translate: "0 0", offset: 0.74 },
			{ opacity: 0, translate: "0 0", offset: 1 },
		],
		2.5,
		0.95,
		E.out,
	);
	ctx.hold(
		s(HOLD),
		async () => {
			let pick: "3d" | "classic" = stored() === "3d" ? "3d" : "classic";
			if (asking) pick = await ask(el, choice!);
			else await new Promise((resolve) => setTimeout(resolve, BEAT[ctx.mode] * 1000));
			// 3D on the home page: the studio is built under the opening page (switched on just now after a first visit's
			// answer), and the logo lands on the logo on its wall. Too slow, or no 3D here: the navbar as usual.
			if (pick === "3d" && document.querySelector("[data-studio]")) {
				if (asking) startStudio();
				const studio = await whenLive(9000);
				const wall = studio?.logoRect();
				if (studio && onScreen(wall ?? undefined)) landing = () => studio.logoRect() ?? navLogo().img?.getBoundingClientRect();
			}
			retarget();
		},
		{ skip: !asking },
	);
	// Crossfade into the real navbar image once they're on top of each other (the PNG has a soft shadow
	// and bevel the flat vectors don't, so this is a blend rather than a swap).
	tween(logo, [{ opacity: 1 }, { opacity: 0 }], LAND - 0.02, END - LAND, E.inOut);
	ctx.endWith(tween(navWrap, [{ opacity: 0 }, { opacity: 1 }], LAND - 0.02, END - LAND, E.inOut));

	if (ctx.mode === "full") startParallax(ctx, parallax);
	ctx.devExtras({ retarget });
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

/** Transform (origin: top-left) that puts the splash logo exactly over `to` (the navbar logo, or the studio's wall). */
function flightTarget(logo: HTMLElement, to: DOMRect | null | undefined) {
	const from = logo.getBoundingClientRect();
	// Header hidden or off-screen (e.g. the page opened scrolled down): shrink away in place instead.
	if (!onScreen(to ?? undefined)) {
		const k = 0.9;
		return `translate(${(from.width * (1 - k)) / 2}px, ${(from.height * (1 - k)) / 2}px) scale(${k})`;
	}
	return flip(from, to!);
}

/** The visitor's saved answer: "3d", "classic" or null. */
function stored() {
	try {
		return localStorage.getItem("experience");
	} catch {
		return null;
	}
}

/**
 * The first-visit question on the opening page: shows the two cards, and resolves with the answer (saved in this
 * browser, read by BaseLayout's head script and the Settings panel). Escape means Classic. While it asks, the overlay
 * is a labelled dialog that keeps the keyboard's focus on its two buttons.
 */
function ask(overlay: HTMLElement, choice: HTMLElement): Promise<"3d" | "classic"> {
	const buttons = [...choice.querySelectorAll<HTMLButtonElement>("[data-intro-pick]")];
	choice.hidden = false;
	overlay.removeAttribute("aria-hidden");
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-modal", "true");
	overlay.setAttribute("aria-labelledby", "intro-choice-title");
	overlay.setAttribute("aria-describedby", "intro-slogan");
	requestAnimationFrame(() => overlay.setAttribute("data-asking", ""));
	buttons.find((b) => b.dataset.introPick === "classic")?.focus({ preventScroll: true });
	return new Promise((resolve) => {
		const answer = (pick: "3d" | "classic") => {
			choice.removeEventListener("click", onClick);
			removeEventListener("keydown", onKey, true);
			try {
				localStorage.setItem("experience", pick);
			} catch {
				/* nothing can be remembered: asked again next time */
			}
			overlay.removeAttribute("data-asking");
			overlay.querySelector<HTMLElement>("[data-splash-skip]")?.style.setProperty("display", "none"); // answered: no Skip needed
			overlay.setAttribute("aria-hidden", "true");
			for (const name of ["role", "aria-modal", "aria-labelledby", "aria-describedby"]) overlay.removeAttribute(name);
			(document.activeElement as HTMLElement | null)?.blur();
			resolve(pick);
		};
		const onClick = (event: Event) => {
			const button = (event.target as Element).closest<HTMLButtonElement>("[data-intro-pick]");
			if (button) answer(button.dataset.introPick === "3d" ? "3d" : "classic");
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				answer("classic");
			} else if (event.key === "Tab") {
				event.preventDefault();
				const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
				buttons[(i + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
			}
		};
		choice.addEventListener("click", onClick);
		addEventListener("keydown", onKey, true);
	});
}

/* ---------- Parallax (desktop only): the logo leans a little toward the mouse ---------- */
function startParallax(ctx: SplashContext, el: HTMLElement) {
	if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
	const target = { x: 0, y: 0 };
	const cur = { x: 0, y: 0 };
	const t0 = performance.now();
	let raf = 0;
	const onMove = (e: PointerEvent) => {
		if (e.pointerType !== "mouse") return;
		target.x = (e.clientX / innerWidth - 0.5) * 2;
		target.y = (e.clientY / innerHeight - 0.5) * 2;
	};
	addEventListener("pointermove", onMove, { passive: true });
	const stop = () => {
		cancelAnimationFrame(raf);
		removeEventListener("pointermove", onMove);
		el.style.transform = "";
	};
	ctx.onCleanup(stop);
	const frame = (now: number) => {
		const t = (now - t0) / 1000;
		// Glide back to centre before take-off so the flight starts from the true position.
		const settle = t > s(2.4);
		const k = settle ? 0.2 : 0.08;
		cur.x += ((settle ? 0 : target.x) - cur.x) * k;
		cur.y += ((settle ? 0 : target.y) - cur.y) * k;
		if (t >= s(FLY - 0.08)) return stop();
		el.style.transform = `translate3d(${cur.x * 10}px, ${cur.y * 8}px, 0) rotateX(${-cur.y * 3}deg) rotateY(${cur.x * 4}deg)`;
		raf = requestAnimationFrame(frame);
	};
	raf = requestAnimationFrame(frame);
}

runSplash("jpl", play, { fastRate: FAST_RATE });

export {};
