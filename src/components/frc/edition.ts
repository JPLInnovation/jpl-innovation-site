/**
 * The FRC page's race-weekend devices (the special edition, src/pages/work/frc.astro and src/components/frc/*):
 *
 *   column lines   the page's seven column lines draw themselves down as you start to scroll
 *   rolling letters  a button's letters roll up one after another when it is pointed at or focused ([data-roll])
 *   lights         the top's photos come up one after the other once the intro has gone (Hero.astro)
 *   statement      the words light up with the scroll; the small photos drift and come into colour (Statement.astro)
 *   history        the pinned season chapters and their photo reel (History.astro)
 *   agenda         the KitBot driving down the calendar (Agenda.astro)
 *   gallery        the pits strip: drag, arrows, count, progress (Gallery.astro)
 *
 * One scroll loop for all of them: every frame first reads, then writes, and only what is near the screen does work.
 * Transforms and opacity only. Without motion (reduced motion, Settings' Reduced) nothing moves: the history is a list,
 * the words and photos simply show, the robot stands at the top of its lane; the gallery still slides by hand.
 */
import { afterIntro } from "@/lib/splash";
import { sceneAt } from "@/lib/look/frc-race";

type Frame = () => (() => void) | void;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

let frames: Frame[] = [];
let stop = new AbortController();

function rollLetters(root: ParentNode) {
	for (const el of root.querySelectorAll<HTMLElement>("[data-roll]:not(.frc-roll)")) {
		const text = el.textContent?.trim() ?? "";
		const sr = document.createElement("span");
		sr.className = "sr-only";
		sr.textContent = text;
		const row = () => {
			const r = document.createElement("span");
			r.className = "rw";
			r.setAttribute("aria-hidden", "true");
			[...text].forEach((ch, i) => {
				const c = document.createElement("span");
				c.className = ch === " " ? "c sp" : "c";
				c.style.setProperty("--i", String(i));
				c.textContent = ch === " " ? " " : ch;
				r.append(c);
			});
			return r;
		};
		el.replaceChildren(sr, row(), row());
		el.classList.add("frc-roll");
	}
}

function columnLines() {
	const cols = document.querySelector<HTMLElement>("[data-frc-cols]");
	if (!cols) return;
	let last = -1;
	frames.push(() => {
		const lp = clamp(scrollY / (innerHeight * 1.3));
		if (Math.abs(lp - last) < 0.002) return;
		last = lp;
		return () => cols.style.setProperty("--lp", lp.toFixed(3));
	});
}

function lights() {
	const hero = document.querySelector<HTMLElement>("[data-frc-hero]");
	if (!hero) return;
	afterIntro().then(() => requestAnimationFrame(() => hero.classList.add("is-lit")));
}

function statement() {
	const sec = document.querySelector<HTMLElement>("[data-frc-statement]");
	const h = sec?.querySelector<HTMLElement>(".fs-h");
	if (!sec || !h) return;
	const photos = [...sec.querySelectorAll<HTMLElement>(".fs-ph")];
	const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-on", e.isIntersecting)), { rootMargin: "-30% 0px -30% 0px" });
	photos.forEach((p) => io.observe(p));
	stop.signal.addEventListener("abort", () => io.disconnect());
	frames.push(() => {
		const r = sec.getBoundingClientRect();
		if (r.bottom < 0 || r.top > innerHeight) return;
		const hr = h.getBoundingClientRect();
		const k = clamp((innerHeight * 0.82 - hr.top) / (innerHeight * 0.42 + hr.height));
		const mid = r.top + r.height / 2 - innerHeight / 2;
		return () => {
			h.style.setProperty("--k", k.toFixed(3));
			for (const p of photos) p.style.transform = `translate3d(0, ${(mid * Number(p.dataset.speed)).toFixed(1)}px, 0)`;
		};
	});
}

function history() {
	const sec = document.querySelector<HTMLElement>("[data-frc-history]");
	if (!sec) return;
	sec.classList.add("is-live");
	const scenes = [...sec.querySelectorAll<HTMLElement>(".fhis-scene")];
	const reel = [...sec.querySelectorAll<HTMLElement>(".fhis-frame")];
	const track = sec.querySelector<HTMLElement>(".fhis-track")!;
	const bar = sec.querySelector<HTMLElement>(".fhis-bar")!;
	const num = sec.querySelector<HTMLElement>(".fhis-n")!;
	const n = scenes.length;
	let cur = 0;
	let frameH = 0;
	let reelH = 0;
	const measure = () => {
		frameH = reel[0].offsetHeight;
		reelH = track.parentElement!.offsetHeight;
	};
	measure();
	addEventListener("resize", measure, { signal: stop.signal });
	frames.push(() => {
		const r = sec.getBoundingClientRect();
		if (r.bottom < 0 || r.top > innerHeight) return;
		const p = clamp(-r.top / (r.height - innerHeight));
		const i = sceneAt(p, n);
		const q = clamp(p * n - 0.5, 0, n - 1);
		const y = reelH / 2 - frameH / 2 - q * (frameH + innerHeight * 0.05);
		return () => {
			track.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
			bar.style.setProperty("--p", p.toFixed(4));
			if (i === cur) return;
			scenes[cur].classList.remove("is-on");
			reel[cur].classList.remove("is-on");
			cur = i;
			scenes[i].classList.add("is-on");
			reel[i].classList.add("is-on");
			sec.dataset.route = scenes[i].dataset.route;
			num.textContent = String(i + 1);
		};
	});
}

function agenda() {
	const sec = document.querySelector<HTMLElement>("[data-frc-agenda]");
	const car = sec?.querySelector<HTMLElement>(".fag-car");
	if (!sec || !car) return;
	const rows = [...sec.querySelectorAll<HTMLElement>(".fag-row")];
	const lit = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("is-lit", e.isIntersecting)), { rootMargin: "-50% 0px -50% 0px" });
	rows.forEach((r) => lit.observe(r));
	const arrive = new IntersectionObserver(([e]) => sec.classList.toggle("is-in", e.isIntersecting), { rootMargin: "0px 0px -25% 0px" });
	arrive.observe(sec.querySelector(".fag-rows")!);
	stop.signal.addEventListener("abort", () => (lit.disconnect(), arrive.disconnect()));
	let lastY = scrollY;
	let lean = 0;
	let settle = 0;
	const last = rows[rows.length - 1];
	frames.push(() => {
		const r = sec.getBoundingClientRect();
		if (r.bottom < 0 || r.top > innerHeight) {
			lastY = scrollY;
			return;
		}
		const v = scrollY - lastY;
		lastY = scrollY;
		const gone = last.getBoundingClientRect().bottom < innerHeight * 0.5;
		const to = clamp(v * 0.35, -7, 7);
		return () => {
			sec.classList.toggle("is-gone", gone);
			if (Math.abs(to - lean) > 0.2) car.style.rotate = `${(lean = to).toFixed(1)}deg`;
			clearTimeout(settle);
			settle = window.setTimeout(() => (car.style.rotate = `${(lean = 0)}deg`), 140);
		};
	});
}

function gallery() {
	const sec = document.querySelector<HTMLElement>("[data-frc-gallery]");
	const track = sec?.querySelector<HTMLElement>("[data-gal-track]");
	if (!sec || !track) return;
	const cards = [...track.children] as HTMLElement[];
	const n = sec.querySelector<HTMLElement>("[data-gal-n]")!;
	const bar = sec.querySelector<HTMLElement>("[data-gal-bar]")!;
	const prev = sec.querySelector<HTMLButtonElement>("[data-gal-prev]")!;
	const next = sec.querySelector<HTMLButtonElement>("[data-gal-next]")!;
	const ghost = sec.querySelector<HTMLElement>(".fgal-ghost");
	const motion = document.documentElement.classList.contains("motion");
	const step = () => cards[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || "16");
	let on = 0;
	let pending = 0;
	const place = () => {
		pending = 0;
		const max = track.scrollWidth - track.clientWidth;
		const i = Math.min(cards.length - 1, Math.round(track.scrollLeft / step()));
		bar.style.setProperty("--p", String(clamp((track.scrollLeft + track.clientWidth) / track.scrollWidth, 0.05)));
		prev.disabled = track.scrollLeft < 4;
		next.disabled = track.scrollLeft > max - 4;
		if (i !== on) {
			cards[on].classList.remove("is-on");
			cards[(on = i)].classList.add("is-on");
			n.textContent = String(i + 1);
		}
	};
	place();
	track.addEventListener("scroll", () => (pending ||= requestAnimationFrame(place)), { passive: true, signal: stop.signal });
	const go = (d: number) => track.scrollBy({ left: d * step(), behavior: motion ? "smooth" : "auto" });
	prev.addEventListener("click", () => go(-1), { signal: stop.signal });
	next.addEventListener("click", () => go(1), { signal: stop.signal });
	// Drag with a mouse (touch and trackpads scroll it natively). A drag is not a click on the photo under it.
	let down = false;
	let moved = 0;
	let sx = 0;
	let sl = 0;
	track.addEventListener(
		"pointerdown",
		(e) => {
			if (e.pointerType !== "mouse" || e.button !== 0) return;
			down = true;
			moved = 0;
			sx = e.clientX;
			sl = track.scrollLeft;
		},
		{ signal: stop.signal },
	);
	addEventListener(
		"pointermove",
		(e) => {
			if (!down) return;
			const dx = e.clientX - sx;
			moved = Math.max(moved, Math.abs(dx));
			if (moved > 6) track.classList.add("is-drag");
			track.scrollLeft = sl - dx;
		},
		{ signal: stop.signal },
	);
	addEventListener(
		"pointerup",
		() => {
			if (!down) return;
			down = false;
			if (!track.classList.contains("is-drag")) return;
			// Let snapping take over again from where the drag left it.
			const left = track.scrollLeft;
			track.classList.remove("is-drag");
			track.scrollLeft = left;
		},
		{ signal: stop.signal },
	);
	track.addEventListener(
		"click",
		(e) => {
			if (moved > 6) {
				e.preventDefault();
				e.stopPropagation();
				moved = 0;
			}
		},
		{ capture: true, signal: stop.signal },
	);
	if (!motion || !ghost) return;
	frames.push(() => {
		const r = sec.getBoundingClientRect();
		if (r.bottom < 0 || r.top > innerHeight) return;
		const p = clamp((innerHeight - r.top) / (innerHeight + r.height));
		return () => (ghost.style.transform = `translate3d(${(-p * 22).toFixed(2)}%, 0, 0)`);
	});
}

function init() {
	stop.abort();
	stop = new AbortController();
	frames = [];
	if (!document.querySelector("[data-frc-edition]")) return;
	const root = document.documentElement;
	const motion = root.classList.contains("motion") && !root.classList.contains("reduce-motion");
	rollLetters(document);
	gallery();
	if (!motion) return;
	columnLines();
	lights();
	statement();
	history();
	agenda();
	let pending = 0;
	const tick = () => {
		pending = 0;
		const writes = frames.map((f) => f());
		for (const w of writes) w?.();
	};
	const onScroll = () => (pending ||= requestAnimationFrame(tick));
	addEventListener("scroll", onScroll, { passive: true, signal: stop.signal });
	addEventListener("resize", onScroll, { signal: stop.signal });
	tick();
}

init();
document.addEventListener("astro:page-load", init);
