import { useEffect, useRef, type ReactNode } from "react";
import { afterIntro } from "@/lib/splash";
import type { ShowcaseModel } from "@/lib/three/showcase";
import type { StageContext, StageView } from "@/lib/three/stage";

/**
 * Scroll showcase: a model turns to each feature as its text scrolls past (use `client:visible`).
 *
 * From 768 px up, when motion is allowed: the 3D stage stays pinned (beside the text from 1024 px, above it below
 * that) while the features scroll in normal flow; the page scrolls natively and the stage reads where it is each frame
 * (src/lib/three/showcase.ts). Beside the text, the 3D runs on to the edge of the window, and every edge of it fades
 * out, so close-ups dissolve instead of being cut off by a straight line. Phones and reduced motion: a plain stack of
 * cards, each with its still (public/showcase/<model>/<id>.webp) when there is one. No WebGL: the same cards, under
 * `children`.
 *
 * All the text is server-rendered. `children` is the page's own picture: shown in the stage until the 3D is ready,
 * without JavaScript, and above the cards when WebGL is unavailable.
 * Dev: ?showcase=capture makes the stage fill the window (for scripts/showcase-stills.py); window.__showcase jumps
 * between stops (see src/lib/three/showcase.ts).
 */
const models = {
	drone: () => import("@/lib/three/models/drone-showcase"),
};

/** What a showcase model module exports. `ids`: the features, in page order (a stop per feature). */
interface ShowcaseModule {
	default: (ctx: StageContext, ids: string[]) => Promise<ShowcaseModel>;
	view: StageView;
}

export interface ShowcaseText {
	heading: string;
	intro: string;
	/** A smaller line under the intro. */
	note?: string;
	modelLabel: string;
	dotsLabel: string;
	features: ReadonlyArray<{ id: string; title: string; text: string; facts: ReadonlyArray<{ label: string; value: string }> }>;
}

interface Props {
	model: keyof typeof models;
	text: ShowcaseText;
	/** Feature id → still picture URL, for the features that have one. */
	stills?: Record<string, string>;
	children?: ReactNode;
	/** Extra classes for the section (spacing above it). */
	className?: string;
}

const PINNED = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

/* Layout modes. Pinned needs the width, motion allowed, and no WebGL failure ([data-static]). Unlayered, so these beat
   the stacked look's utility classes. The view (canvas and labels) fades out at every edge through a mask, which works
   the same on both themes; beside the text it runs on into the column gap and to the window's right edge. */
const css = `
.showcase{overflow-x:clip}
.showcase-stage,.showcase-probe{display:none}
.showcase-view{position:absolute;inset:0;--fade:clamp(1.5rem,7%,4rem);-webkit-mask-image:linear-gradient(90deg,transparent,#000 var(--fade),#000 calc(100% - var(--fade)),transparent),linear-gradient(transparent,#000 var(--fade),#000 calc(100% - var(--fade)),transparent);-webkit-mask-composite:source-in;mask-image:linear-gradient(90deg,transparent,#000 var(--fade),#000 calc(100% - var(--fade)),transparent),linear-gradient(transparent,#000 var(--fade),#000 calc(100% - var(--fade)),transparent);mask-composite:intersect}
.showcase[data-static] .showcase-stage{display:block;position:relative;max-width:42rem;aspect-ratio:4/3;margin-bottom:1rem}
.showcase[data-static] .showcase-view,.showcase[data-static] .showcase-dots{display:none}
@media (min-width:48rem) and (prefers-reduced-motion:no-preference){
.showcase:not([data-static]) .showcase-track{position:relative}
.showcase:not([data-static]) .showcase-probe{display:block;position:absolute;top:0;width:0;height:100vh;height:100svh;visibility:hidden}
.showcase:not([data-static]) .showcase-stage{display:block;position:sticky;top:0;z-index:1;height:55svh;background:var(--background)}
.showcase:not([data-static]) .showcase-features{display:block}
.showcase:not([data-static]) .showcase-feature{display:flex;flex-direction:column;justify-content:center;min-height:45svh;scroll-margin-top:calc(55svh - 5.5rem);padding:2rem 0;border:0;border-radius:0;background:none;box-shadow:none;transition:opacity .3s}
.showcase:not([data-static]) .showcase-still{display:none}
.showcase[data-live]:not([data-static]) .showcase-feature:not([data-active]){opacity:.5}
.showcase[data-live]:not([data-static]) .showcase-copy{border-left-width:2px;padding-left:1.25rem}
.showcase[data-live]:not([data-static]) .showcase-feature[data-active] .showcase-copy{border-color:var(--accent)}
}
@media (min-width:64rem) and (prefers-reduced-motion:no-preference){
.showcase:not([data-static]) .showcase-track{--gap:clamp(2rem,4vw,3.5rem);display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);column-gap:var(--gap)}
.showcase:not([data-static]) .showcase-stage{grid-area:1/2;height:100svh;background:none}
.showcase:not([data-static]) .showcase-view{left:calc(-1 * var(--gap));right:calc(-1 * ((100vw - min(100vw, 76rem)) / 2 + clamp(1rem, 4vw, 2.5rem)))}
.showcase:not([data-static]) .showcase-features{grid-area:1/1}
.showcase:not([data-static]) .showcase-feature{min-height:100svh;scroll-margin-top:0}
}
@media (min-width:48rem) and (prefers-reduced-motion:no-preference){
.showcase[data-capture]:not([data-static]) .showcase-stage{position:fixed;inset:0;z-index:100;height:auto}
.showcase[data-capture]:not([data-static]) .showcase-view{inset:0;-webkit-mask-image:none;mask-image:none}
}`;

export default function Showcase({ model, text, stills = {}, children, className }: Props) {
	const sectionRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const section = sectionRef.current!;
		const track = section.querySelector<HTMLElement>(".showcase-track")!;
		const probe = section.querySelector<HTMLElement>(".showcase-probe")!;
		const stage = section.querySelector<HTMLElement>(".showcase-stage")!;
		const view = stage.querySelector<HTMLElement>(".showcase-view")!;
		const canvas = view.querySelector("canvas")!;
		const articles = [...section.querySelectorAll<HTMLElement>(".showcase-feature")];
		const dots = [...section.querySelectorAll<HTMLAnchorElement>(".showcase-dots a")];
		const pinned = matchMedia(PINNED);
		const wide = matchMedia("(min-width: 1024px)");
		if (new URLSearchParams(location.search).get("showcase") === "capture") section.dataset.capture = "";

		// The page scroll offsets at which each feature sits where it's read: mid-screen beside the stage, or mid-way down
		// the space under it. Measured when anything on the page changes size; each frame then only reads scrollY, which
		// never makes the browser lay the page out again.
		let marks: number[] = [];
		const measure = () => {
			const height = probe.offsetHeight; // 100svh: the mobile address bar doesn't move it
			const line = wide.matches ? height / 2 : (stage.offsetHeight + height) / 2;
			const top = track.getBoundingClientRect().top + scrollY;
			marks = articles.map((a) => top + a.offsetTop + a.offsetHeight / 2 - line);
		};
		const position = () => {
			const y = scrollY;
			if (!marks.length || y <= marks[0]) return 0;
			for (let i = 1; i < marks.length; i++) {
				if (y < marks[i]) return i - 1 + (y - marks[i - 1]) / (marks[i] - marks[i - 1]);
			}
			return marks.length - 1;
		};
		const onStop = (index: number) => {
			articles.forEach((a, i) => a.toggleAttribute("data-active", i === index));
			dots.forEach((d, i) => (i === index ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current")));
		};
		const resize = new ResizeObserver(measure);

		let cancelled = false;
		let started = false;
		let dispose: (() => void) | undefined;
		const start = () => {
			if (started || !pinned.matches) return;
			started = true;
			resize.observe(track);
			resize.observe(document.documentElement); // things above the showcase changing height move it
			measure();
			Promise.all([import("@/lib/three/stage"), import("@/lib/three/showcase"), models[model](), afterIntro()])
				.then(async ([stageModule, showcase, loaded]) => {
					if (cancelled) return;
					const mod = loaded as unknown as ShowcaseModule;
					const ids = text.features.map((f) => f.id);
					const titles = text.features.map((f) => f.title);
					dispose = await stageModule.mountStage(
						view,
						canvas,
						async (ctx) => showcase.drive(ctx, await mod.default(ctx, ids), { titles, position, onStop }),
						mod.view,
					);
					if (cancelled) dispose();
					else section.dataset.live = "";
				})
				.catch((error) => {
					console.warn(`Showcase "${model}" has no 3D, showing the stacked layout.`, error);
					if (!cancelled) section.dataset.static = "";
				});
		};
		start();
		pinned.addEventListener("change", start); // e.g. a tablet turned to landscape

		return () => {
			cancelled = true;
			pinned.removeEventListener("change", start);
			resize.disconnect();
			dispose?.();
		};
		// The text and model are fixed per page.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [model]);

	return (
		<section
			ref={sectionRef}
			className={`showcase group ${className ?? ""}`}
			aria-labelledby="showcase-heading"
		>
			<style>{css}</style>
			<div className="wrapper flex flex-col gap-10 pb-24">
				<div className="flex max-w-2xl flex-col gap-3">
					<h2 id="showcase-heading" className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] font-[850]">
						{text.heading}
					</h2>
					<p className="text-lg text-muted-foreground">{text.intro}</p>
					{text.note && <p className="text-sm text-muted-foreground">{text.note}</p>}
				</div>
				<div className="showcase-track">
					<div className="showcase-probe" aria-hidden="true" />
					<div className="showcase-stage">
						<div className="showcase-view">
							<canvas
								role="img"
								aria-label={text.modelLabel}
								className="absolute inset-0 size-full opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-live:opacity-100"
							/>
						</div>
						{children && (
							<div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-500 group-data-live:opacity-0">
								{children}
							</div>
						)}
						<nav aria-label={text.dotsLabel} className="showcase-dots absolute inset-x-0 bottom-3 z-10 flex justify-center">
							<ol className="flex">
								{text.features.map((f) => (
									<li key={f.id}>
										<a href={`#${f.id}`} className="group/dot flex size-8 items-center justify-center rounded-full">
											<span className="sr-only">{f.title}</span>
											<span
												aria-hidden="true"
												className="size-2 rounded-full bg-foreground/30 transition-[background-color,transform] duration-300 group-hover/dot:bg-foreground/60 group-aria-[current=step]/dot:scale-125 group-aria-[current=step]/dot:bg-accent"
											/>
										</a>
									</li>
								))}
							</ol>
						</nav>
					</div>
					<div className="showcase-features grid gap-4 md:grid-cols-2">
						{text.features.map((f) => (
							<article key={f.id} id={f.id} className="showcase-feature flex flex-col gap-5 rounded-xl border surface p-5 sm:p-6">
								{stills[f.id] && (
									<img
										src={stills[f.id]}
										alt=""
										width={1200}
										height={900}
										loading="lazy"
										decoding="async"
										className="showcase-still aspect-[4/3] w-full object-contain"
									/>
								)}
								<div className="showcase-copy flex max-w-[44ch] flex-col gap-4 border-transparent transition-colors duration-300">
									<h3 className="font-wide text-2xl font-[850] md:text-3xl">{f.title}</h3>
									<p className="text-lg">{f.text}</p>
									<dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5">
										{f.facts.map((fact) => (
											<div key={fact.label} className="flex flex-col gap-1">
												<dt className="text-sm text-muted-foreground">{fact.label}</dt>
												<dd className="font-semibold">{fact.value}</dd>
											</div>
										))}
									</dl>
								</div>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
