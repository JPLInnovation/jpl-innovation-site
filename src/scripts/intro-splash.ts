/**
 * The JPL intro. Markup and CSS: src/components/IntroSplash.astro. Shared overlay, skip, reduced motion and clean-up:
 * src/scripts/splash-core.ts. Two versions (src/lib/splash.ts):
 *
 *   full     once per visit: the Pre-flight hook (src/scripts/preflight.ts) plays first and opens its hangar doors onto
 *            the opening page with the logo already finished; then the hold and the hand-off below.
 *   fast     a refresh or a later visit in the same tab: the logo builds itself, 2.8 s played FAST_RATE times faster:
 *     wrench   the wrench swings in from the left on an arc (stretched while it's fast), overshoots,
 *              tightens a quarter-turn with a small bounce and settles. It enters silver and turns teal
 *              as the screen lights up behind it, so it never disappears into the navy.
 *     boot     the ring draws itself round, the monitor outline draws on and fills, the screen flickers on
 *              with a soft cyan glow, the signal waves pulse out from the wrench, inner to outer.
 *     type-on  J P L, a short pause, I N N O V A T I O N: each whole letter rises a few pixels and fades in on the
 *              word's baseline (no scale, no overshoot, no cursor: mid-way, the word must never look torn).
 *     slogan   "Sketch it. Build it. Secure it." comes in under the logo.
 *
 * Then, in both:
 *   hold     the opening page: the timeline stops (ctx.hold). A first visit on a computer that could run the 3D is
 *            asked 3D or Classic here (BaseLayout put html.choose-experience on); later visits pause for a beat. Skipped
 *            before it asked, the pop-up (ExperienceChoice.astro) asks after the intro instead.
 *   hand-off a light sweep, then the logo flies (FLIP) into the navbar logo, or with 3D on the home page onto the
 *            logo on the studio's wall (src/lib/handoff.ts), while the overlay fades and the page or the room appears.
 *            After Pre-flight a line also draws itself round the first glass sheet.
 *
 * The logo's beats are written on a 3.78 s design clock (plus the hold) and played back SPEED times faster; after
 * Pre-flight the hand-off's marks move later by the time Pre-flight took.
 */
import { startStudio, whenLive } from "@/lib/handoff";
import { markSeen } from "@/lib/splash";
import { preflight } from "./preflight";
import { E, flip, onScreen, runSplash, type Frames, type SplashContext } from "./splash-core";

const SPEED = 3.28 / 2.8;
const FAST_RATE = 2.5;
const s = (t: number) => t / SPEED; // design seconds → real seconds

/** Design-clock marks. */
const HOLD = 2.9; // the opening page: logo and slogan up, the timeline waits here
const FLY = 3.24; // the logo starts flying to the navbar (or the studio's wall)
const LAND = 3.64; // ...and lands
const END = 3.78; // crossfade into the real navbar logo done
/** How long later visits rest on the opening page, in real seconds (after Pre-flight, after the fast logo). */
const BEAT = { full: 0.7, fast: 0.25 };

const root = document.documentElement;

/** The navbar logo that's showing (light or dark variant). */
function navLogo() {
	const wrap = document.querySelector<HTMLElement>("[data-site-header] [data-site-logo]");
	const img = wrap && [...wrap.querySelectorAll("img")].find((i) => i.getClientRects().length > 0);
	return { wrap, img };
}

type Tween = (target: Element | null | undefined, frames: Frames, start: number, dur: number, easing?: string, options?: KeyframeAnimationOptions) => Animation | undefined;

function play(ctx: SplashContext) {
	const { el } = ctx;
	/** Tween on the design clock. */
	const tween: Tween = (target, frames, start, dur, easing = E.out, options) => ctx.tween(target, frames, s(start), s(dur), easing, options);

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
	// The first-visit question is asked here, not in the pop-up (ExperienceChoice.astro). Skipped before it was asked,
	// the pop-up asks it as the intro goes (its own script has already looked and let it be).
	const asking = root.classList.contains("choose-experience") && !!choice;
	let answered = !asking;
	if (asking) {
		root.classList.remove("choose-experience");
		ctx.onCleanup(() => {
			if (answered) return;
			root.classList.add("choose-experience");
			const dialog = document.getElementById("experience-dialog") as HTMLDialogElement | null;
			if (dialog && !dialog.open) dialog.showModal();
		});
	}
	el.toggleAttribute("data-will-ask", asking);
	/** Where the logo lands: the navbar logo, unless the studio's wall takes over (3D, home page). */
	let landing = () => navLogo().img?.getBoundingClientRect();

	// Pre-flight (the full version) comes first and opens onto the finished logo; the fast version builds the logo.
	const pre = ctx.mode === "full" ? preflight(ctx) : undefined;
	if (!pre) buildLogo(tween, svg, $, parallax);
	/** The opening page's marks move later by the time Pre-flight takes (design seconds). */
	const o = pre ? pre.open * SPEED - HOLD : 0;
	const d = (t: number) => t + o;

	/* ---------- Hand-off (design 2.96–3.78 s) ---------- */
	tween(
		$("sweep"),
		[
			{ opacity: 0, translate: "0 0" },
			{ opacity: 1, translate: "100px 0", offset: 0.08 },
			{ opacity: 1, translate: "900px 0", offset: 0.92 },
			{ opacity: 0, translate: "980px 0" },
		],
		d(2.96),
		0.4,
		E.inOut,
	);
	// FLIP into the navbar logo. Measured now, and again just before take-off (fonts or the scrollbar can
	// nudge the header while the intro plays).
	const flight = tween(logo, [{ transform: "none" }, { transform: flightTarget(logo, landing()) }], d(FLY), LAND - FLY, E.fly);
	const retarget = () => (flight?.effect as KeyframeEffect | undefined)?.setKeyframes([{ transform: "none" }, { transform: flightTarget(logo, landing()) }]);
	ctx.at(s(d(FLY - 0.06)), () => {
		// Only while it's genuinely about to take off (not paused, not already moving).
		if (flight && flight.playState === "running" && Number(flight.currentTime) < s(d(FLY)) * 1000) retarget();
	});
	tween(bg, [{ opacity: 1 }, { opacity: 0 }], d(3.3), LAND - 3.3, E.out);
	ctx.at(s(d(3.3)), () => root.classList.add("splash-leaving")); // scrollbar back to the page's colours
	tween(skipButton, [{ opacity: 1 }, { opacity: 0 }], d(3.1), 0.3, E.out);
	if (!root.classList.contains("dark")) {
		// Light theme: the navbar logo has navy "JPL", so the silver letters turn navy on the way.
		tween($("jpl-ink"), [{ opacity: 0 }, { opacity: 1 }], d(3.34), 0.28, E.inOut);
	}
	// After Pre-flight: the line round the first glass sheet, and the verbs and the sticker go with the field.
	pre?.leave(s(d(2.96)), s(END - 2.96));

	/* ---------- Slogan, and the opening page's hold (design 2.5-3.45 s, the hold at 2.9) ---------- */
	// One animation for in and out (two on the same element would fight over its opacity before the second starts).
	// After Pre-flight the verbs are already up (pre.leave takes them away).
	if (!pre) {
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
	}
	ctx.hold(
		s(d(HOLD)),
		async () => {
			let pick: "3d" | "classic" = stored() === "3d" ? "3d" : "classic";
			if (asking) {
				pick = await ask(el, choice!);
				answered = true;
			} else await new Promise((resolve) => setTimeout(resolve, BEAT[ctx.mode] * 1000));
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
	// and bevel the flat vectors don't, so this is a blend rather than a swap). Forwards only: Pre-flight brings the
	// logo in earlier.
	tween(logo, [{ opacity: 1 }, { opacity: 0 }], d(LAND - 0.02), END - LAND, E.inOut, { fill: "forwards" });
	ctx.endWith(tween(navWrap, [{ opacity: 0 }, { opacity: 1 }], d(LAND - 0.02), END - LAND, E.inOut));

	ctx.devExtras({ retarget });
}

/** The fast version's opening: the logo builds itself (design 0–2.6 s). */
function buildLogo(tween: Tween, svg: SVGSVGElement, $: (id: string) => SVGGraphicsElement | null, parallax: HTMLElement) {
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
	letterIds.forEach((id, k) => {
		tween(
			$(id),
			[
				{ opacity: 0, translate: "0 6px" },
				{ opacity: 1, translate: "0 0" },
			],
			letterStart(k),
			0.3,
			E.out,
		);
	});
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

// The hook is once per visit: this tab has had it (a refresh or a later visit gets the fast logo; src/lib/splash.ts).
if (root.classList.contains("intro-full") && document.querySelector('[data-splash="jpl"]')) markSeen("jpl");
runSplash("jpl", play, { fastRate: FAST_RATE, stillFull: 1 });

export {};
