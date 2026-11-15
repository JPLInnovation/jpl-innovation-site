/**
 * Pre-flight, the hook that opens the site (spec §11). Markup and CSS: src/components/PreflightSplash.astro (the
 * verbs and the sticker sit on IntroSplash's opening page); timing and the counter: src/lib/look/preflight.ts.
 * The JPL intro's full version calls preflight() (src/scripts/intro-splash.ts) and then holds on its opening page and
 * flies the logo to the header as before. Everything runs on splash-core's one clock, so Skip, the holds and the
 * development seek move it like the logo intro.
 *
 *   arming    0-2.7 s  the parts draw themselves, their callouts follow, the boot log ticks, the drums roll to 120 m,
 *                      the rotors spin up
 *   prompt    a quiet hold (nothing under it starts loading): a click, a key or a scroll takes off; after WAIT it
 *                      takes off by itself. Escape and the Skip button still skip.
 *   take-off  the drone rises at you, XIN CHÀO! comes up on the hangar doors, the doors part, the verbs settle and
 *             the sticker lands; `open` is when the opening page is complete
 *   leave()   at the hand-off a line draws itself round the first glass sheet on the page (the header)
 */
import { bootLine, climbAt, altitudeAt, CLIMB, drumsAt, PROMPT_AT } from "@/lib/look/preflight";
import { E, onScreen, type SplashContext } from "./splash-core";

/** Each part: when its lines start drawing and for how long (s). Its callout follows as it finishes. */
const DRAW = { frame: [0.15, 0.55], motors: [0.5, 0.45], props: [0.8, 0.55], controller: [1.15, 0.4], camera: [1.4, 0.4], modem: [1.65, 0.4] } as const;
/** The rotors spin up between `from` and `full` (s); `turn` is one turn at full speed (ms). */
const SPIN = { from: 0.9, full: 2.1, turn: 110 };
/** The prompt waits this long (s), then it takes off by itself. */
const WAIT = 4;
/** After the take-off (s from it). */
const AFTER = { hello: 0.18, doors: 0.85, logo: 1.0, sticker: 1.15, open: 1.85 };
const DOORS = "cubic-bezier(0.7, 0, 0.2, 1)"; // heavy to start, then it glides

export function preflight(ctx: SplashContext) {
	const { el, tween } = ctx;
	const $ = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel);
	const $$ = <T extends Element = HTMLElement>(sel: string) => [...el.querySelectorAll<T>(sel)];
	const appear = (x: Element | null, at: number, dur = 0.45) => tween(x, [{ opacity: 0 }, { opacity: 1 }], at, dur, E.out);

	/* ---------- Arming ---------- */
	for (const x of $$("[data-pf-in]")) appear(x, 0.05);
	for (const [id, [at, dur]] of Object.entries(DRAW)) {
		const lines = $$(`[data-pf-part="${id}"] .pf-line`);
		if (id === "props") lines.push(...$$("[data-pf-disc]"));
		for (const line of lines) tween(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], at, dur, E.inOut);
		const end = at + dur;
		tween($(`[data-pf-callout="${id}"] .pf-leader`), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], end - 0.12, 0.3, E.out);
		appear($(`[data-pf-callout="${id}"] .pf-dot`), end - 0.12, 0.15);
		tween($(`[data-pf-label="${id}"]`), [{ opacity: 0, translate: "6px 0" }, { opacity: 1, translate: "0 0" }], end + 0.05, 0.35, E.out);
	}

	// The drums, the boot log and the rotors follow one clock: an empty animation, so they freeze, skip and seek
	// exactly as the rest of the timeline does.
	const alt = $("[data-pf-alt]")!;
	const clock = tween(alt, [{}, {}], 0, PROMPT_AT, "linear");
	const strips = $$("[data-pf-strip]");
	const rows = $$("[data-pf-row]");
	const status = $("[data-pf-status]");
	const blades = $$<SVGPathElement>("[data-pf-blade]");
	const discs = $$<SVGPathElement>("[data-pf-disc]");
	const spins = blades.map((blade) => {
		const turn = Number(blade.dataset.pfBlade) * 360;
		const a = blade.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${turn}deg)` }], { duration: SPIN.turn, iterations: Infinity });
		a.playbackRate = 0;
		return a;
	});
	let shown = -1;
	let metres = -1;
	let state = "";
	let raf = 0;
	const frame = () => {
		const t = Math.min(PROMPT_AT, Number(clock?.currentTime ?? 0) / 1000);
		const drums = drumsAt(climbAt(t));
		strips.forEach((strip, i) => (strip.style.transform = `translateY(${(-drums[i] * 100) / 11}%)`));
		const m = altitudeAt(t);
		if (m !== metres) alt.dataset.alt = String((metres = m));
		const n = bootLine(t);
		if (n !== shown) rows.forEach((row, i) => row.toggleAttribute("data-on", i < (shown = n)));
		const now = t >= CLIMB.end ? "cruise" : "climb";
		if (now !== state) status?.setAttribute("data-state", (state = now));
		// Spin-up: the blades blur into their discs.
		const k = Math.min(1, Math.max(0, (t - SPIN.from) / (SPIN.full - SPIN.from))) ** 2;
		for (const a of spins) a.playbackRate = k;
		for (const b of blades) b.style.opacity = String(1 - 0.6 * k);
		for (const d of discs) d.style.strokeOpacity = String(0.32 + 0.4 * k);
		if (t < PROMPT_AT) raf = requestAnimationFrame(frame);
	};
	raf = requestAnimationFrame(frame);
	ctx.onCleanup(() => {
		cancelAnimationFrame(raf);
		for (const a of spins) a.cancel();
	});

	/* ---------- The prompt ---------- */
	tween($("[data-pf-prompt]"), [{ opacity: 0, translate: "0 8px" }, { opacity: 1, translate: "0 0" }], PROMPT_AT - 0.3, 0.35, E.out);
	ctx.hold(PROMPT_AT, () => takeOff(ctx), { skip: false, quiet: true });

	/* ---------- Take-off ---------- */
	const t0 = PROMPT_AT;
	// Going out: forwards only, so they don't hold their first frame over the coming-in above until they start.
	const later = { fill: "forwards" } as const;
	tween($("[data-pf-wire]"), [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(3.2)", opacity: 0 }], t0, 0.5, E.inStrong, later);
	for (const x of [...$$("[data-pf-in]"), ...$$(".pf-labels li"), $("[data-pf-prompt]")]) tween(x, [{ opacity: 1 }, { opacity: 0 }], t0, 0.22, E.out, later);
	for (const word of $$("[data-pf-hello]")) tween(word, [{ transform: "translateY(135%)" }, { transform: "translateY(0)" }], t0 + AFTER.hello, 0.5, E.outExpo);
	tween($('[data-pf-door="l"]'), [{ transform: "translateX(0)" }, { transform: "translateX(-51%)" }], t0 + AFTER.doors, 0.6, DOORS);
	tween($('[data-pf-door="r"]'), [{ transform: "translateX(0)" }, { transform: "translateX(51%)" }], t0 + AFTER.doors, 0.6, DOORS);
	// Behind the doors, the opening page: the verbs settle as the doors part, the logo comes up, the sticker lands.
	tween($("[data-intro-verbs]"), [{ transform: "scale(1.07)" }, { transform: "scale(1)" }], t0 + AFTER.doors, 1, E.out);
	appear($("[data-intro-logo]"), t0 + AFTER.logo, 0.4);
	tween($("[data-pf-sticker]"), [{ transform: "scale(0) rotate(-140deg)" }, { transform: "scale(1) rotate(0deg)" }], t0 + AFTER.sticker, 0.6, E.outBackSoft);

	return {
		/** When the opening page is complete (timeline seconds, the prompt's wait not counted). */
		open: t0 + AFTER.open,
		/** The hand-off, from `at` for `dur` seconds: the line round the first glass sheet, and the verbs going. */
		leave(at: number, dur: number) {
			const edge = $<SVGPathElement>("[data-pf-edge]");
			ctx.at(Math.max(0, at - 0.03), () => edge?.setAttribute("d", sheetEdge()));
			tween(
				edge,
				[
					{ strokeDashoffset: 1, opacity: 1 },
					{ strokeDashoffset: 0, opacity: 1, offset: 0.6 },
					{ strokeDashoffset: 0, opacity: 0 },
				],
				at,
				dur,
				E.inOut,
			);
			tween($("[data-intro-verbs]"), [{ opacity: 1 }, { opacity: 0 }], at + dur * 0.4, dur * 0.42, E.out);
		},
	};
}

/**
 * The prompt: resolves on the first click, tap, key or scroll (or after WAIT), and quiets that same input so it doesn't
 * skip what it started. Escape and the Skip button skip the rest instead.
 */
function takeOff(ctx: SplashContext) {
	const { el } = ctx;
	return new Promise<void>((resolve) => {
		let timer = 0;
		const off = () => {
			clearTimeout(timer);
			el.removeEventListener("pointerdown", go);
			removeEventListener("keydown", go, true);
			removeEventListener("wheel", go);
			removeEventListener("touchmove", go);
		};
		function go(event?: Event) {
			off();
			const skip = (event?.target as Element | undefined)?.closest?.("[data-splash-skip]") || (event as KeyboardEvent | undefined)?.key === "Escape";
			if (skip) return ctx.skip();
			ctx.calm(450);
			resolve();
		}
		el.addEventListener("pointerdown", go);
		addEventListener("keydown", go, true);
		addEventListener("wheel", go, { passive: true });
		addEventListener("touchmove", go, { passive: true });
		timer = window.setTimeout(() => go(), WAIT * 1000);
		ctx.onCleanup(off);
	});
}

/**
 * The lower edge of the first glass sheet on screen (the header strip), ruled left to right, as a path in screen
 * pixels; "" when there is none.
 */
function sheetEdge() {
	const sheet = [...document.querySelectorAll<HTMLElement>(".sheet")].find((s) => onScreen(s.getBoundingClientRect()));
	if (!sheet) return "";
	const { left, right, bottom } = sheet.getBoundingClientRect();
	const r = parseFloat(getComputedStyle(sheet).borderBottomLeftRadius) || 0;
	return `M${(left + r).toFixed(1)} ${(bottom - 1).toFixed(1)}H${(right - r).toFixed(1)}`;
}
