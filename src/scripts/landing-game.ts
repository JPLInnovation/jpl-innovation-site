/**
 * "Land the drone", the footer's game (src/components/footer/LandingGame.astro; physics in src/lib/look/landing.ts).
 *
 * Space throttles only while the play area has focus (a click or a press focuses it; Tab reaches it), so it never
 * scrolls the page and never fires in a form field, the email pop-up or the CCNA terminal: those have focus
 * themselves. A press and hold (mouse, pen or finger) throttles too. The loop runs only while a flight is on and the
 * play area is on screen; under reduced motion nothing moves by itself, the visitor still flies it.
 */
import { CEILING, FUEL, landed, start, step, type State } from "@/lib/look/landing";
import { landing as text } from "@/text/site";

const PAD = { y: 0 };
const TICK = 1 / 120;
const BEST = "landing-best";

type Phase = "ready" | "flying" | "soft" | "hard";
let cleanup: (() => void) | undefined;

function readBest(): number | null {
	try {
		const v = sessionStorage.getItem(BEST);
		return v === null ? null : Number(v);
	} catch {
		return null;
	}
}

function init() {
	cleanup?.();
	const root = document.querySelector<HTMLElement>("[data-lander]");
	if (!root) return;
	const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
	const stage = $<HTMLElement>("[data-stage]");
	const drone = $<HTMLElement>("[data-drone]");
	const shadow = $<HTMLElement>("[data-shadow]");
	const alt = $<HTMLElement>("[data-alt]");
	const speed = $<HTMLElement>("[data-speed]");
	const fuel = $<HTMLElement>("[data-fuel]");
	const status = $<HTMLElement>("[data-status]");
	const said = $<HTMLElement>("[data-said]");
	const bestOut = $<HTMLElement>("[data-best]");

	root.querySelectorAll<HTMLElement>("[data-js]").forEach((el) => (el.hidden = false));
	stage.tabIndex = 0;
	stage.setAttribute("role", "button");
	stage.setAttribute("aria-label", text.stageLabel);
	stage.setAttribute("aria-describedby", "lander-status");
	root.dataset.on = "";

	let s: State = start();
	let phase: Phase = "ready";
	let throttle = false;
	let visible = false;
	let raf = 0;
	let last = 0;
	let acc = 0;
	let shown = { alt: "", speed: "" };

	const showBest = () => {
		const best = readBest();
		bestOut.textContent = best === null ? text.bestNone : `${best.toFixed(2)} m/s`;
	};
	showBest();

	const render = () => {
		const y = Math.max(s.y, 0);
		drone.style.setProperty("--alt", y.toFixed(3)); // the drawing turns metres into pixels (LandingGame.astro)
		const near = 1 - y / CEILING;
		shadow.style.scale = String(0.4 + 0.6 * near);
		shadow.style.opacity = String(0.12 + 0.5 * near);
		fuel.style.transform = `scaleX(${(s.fuel / FUEL).toFixed(3)})`;
		const a = y.toFixed(1);
		const v = Math.abs(s.vy).toFixed(1);
		if (a !== shown.alt) alt.textContent = shown.alt = a;
		if (v !== shown.speed) speed.textContent = shown.speed = v;
	};

	const setPhase = (p: Phase) => {
		phase = p;
		root.dataset.phase = p;
	};

	const land = (result: "soft" | "hard") => {
		const touchdown = -s.vy;
		s = { y: PAD.y, vy: 0, fuel: s.fuel };
		last = 0;
		setPhase(result);
		release();
		const fill = (line: string) => line.replace("{speed}", touchdown.toFixed(2)).replace("{fuel}", s.fuel.toFixed(1));
		status.textContent = said.textContent = fill(result === "soft" ? text.soft : text.hard);
		const best = readBest();
		if (result === "soft" && (best === null || touchdown < best)) {
			try {
				sessionStorage.setItem(BEST, touchdown.toFixed(4));
			} catch {}
			showBest();
		}
		shown.speed = "";
		render();
		// the speed it touched down at stays on the readout
		speed.textContent = touchdown.toFixed(1);
	};

	const frame = (now: number) => {
		raf = 0;
		acc += last ? Math.min((now - last) / 1000, 0.05) : 0;
		last = now;
		while (acc >= TICK && phase === "flying") {
			acc -= TICK;
			s = step(s, throttle, TICK);
			const result = landed(s, PAD);
			if (result) land(result);
		}
		if (phase === "flying") render();
		run();
	};
	// Only while a flight is on and the game is on screen; a pause keeps the drone where it was.
	const run = () => {
		if (raf || phase !== "flying" || !visible) return;
		if (!last) acc = 0;
		raf = requestAnimationFrame(frame);
	};
	const pause = () => {
		cancelAnimationFrame(raf);
		raf = 0;
		last = 0;
	};

	const press = () => {
		if (phase !== "flying") {
			s = start();
			setPhase("flying");
			status.textContent = text.howTo;
		}
		throttle = true;
		root.dataset.throttle = "";
		run();
	};
	function release() {
		throttle = false;
		delete root.dataset.throttle;
	}

	const isSpace = (e: KeyboardEvent) => e.code === "Space" || e.key === " ";
	const onKeyDown = (e: KeyboardEvent) => {
		if (!isSpace(e) || e.target !== stage) return;
		e.preventDefault(); // no page scroll
		e.stopPropagation(); // and no other page shortcut on Space
		if (!e.repeat) press();
	};
	const onKeyUp = (e: KeyboardEvent) => {
		if (!isSpace(e) || e.target !== stage) return;
		e.preventDefault();
		release();
	};
	const onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) return;
		e.preventDefault(); // no text selection, no long-press menu
		stage.focus({ preventScroll: true });
		stage.setPointerCapture(e.pointerId);
		press();
	};
	const noMenu = (e: Event) => e.preventDefault();

	stage.addEventListener("keydown", onKeyDown);
	stage.addEventListener("keyup", onKeyUp);
	stage.addEventListener("blur", release);
	stage.addEventListener("pointerdown", onPointerDown);
	stage.addEventListener("pointerup", release);
	stage.addEventListener("pointercancel", release);
	stage.addEventListener("lostpointercapture", release);
	stage.addEventListener("contextmenu", noMenu);

	const footer = root.closest("footer");
	const io = new IntersectionObserver((entries) => {
		for (const e of entries) {
			if (e.target === stage) {
				visible = e.isIntersecting;
				root.toggleAttribute("data-visible", visible);
				if (visible) run();
				else {
					release();
					pause();
				}
			} else footer?.toggleAttribute("data-visible", e.isIntersecting);
		}
	});
	io.observe(stage);
	if (footer) io.observe(footer);
	render();

	// For the page checks (scripts/check-footer.py): read-only.
	(window as unknown as { __lander: unknown }).__lander = {
		state: () => ({ ...s, phase, throttle, visible, running: raf !== 0 }),
	};

	cleanup = () => {
		pause();
		io.disconnect();
		stage.removeEventListener("keydown", onKeyDown);
		stage.removeEventListener("keyup", onKeyUp);
		stage.removeEventListener("blur", release);
		stage.removeEventListener("pointerdown", onPointerDown);
		stage.removeEventListener("pointerup", release);
		stage.removeEventListener("pointercancel", release);
		stage.removeEventListener("lostpointercapture", release);
		stage.removeEventListener("contextmenu", noMenu);
	};
}

document.addEventListener("astro:page-load", init);
