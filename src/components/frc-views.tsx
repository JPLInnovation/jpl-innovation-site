/**
 * The FRC page's pit board views (src/pages/work/frc.astro): each one fits one screen of the board, with the long
 * detail a click away (a drawer, a picker, a tab). Words: src/text/projects/frc.ts.
 *
 *   2026      SeasonGame, SeasonTimeline (with the build season strips and what the season delivered), Filmstrip
 *   Robot     KitBotView (the 2026 robot; its specs and test results in a drawer), HardwareView (motors, control, vision)
 *             (the robot part by part, in 3D: src/components/FrcChapter.astro)
 *   2027      Overview2027, Road2027, Goals2027
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Clock, Flag, Mail, Quote, Trophy, X } from "lucide-react";
import { Grow } from "@/components/motion-primitives";
import { BuildStrips, Countdown } from "@/components/frc-photos";
import { buttonVariants } from "@/components/ui/button";
import {
	board,
	controlStack,
	frcPage,
	frcPhotos,
	hardwareText,
	lightboxText,
	motors,
	season2026,
	season2027,
	season2027More,
	seasonsText,
	vision,
	type FrcPhoto,
	type FrcPhotoId,
	type HardwareItem,
} from "@/text/projects/frc";
import { DataIcon } from "@/lib/icons";
import { srcset } from "@/lib/images";
import { cn } from "@/lib/utils";

const t26 = seasonsText.s2026;
const t27 = seasonsText.s2027;
const small = (id: string) => `/assets/frc/${id}-640.webp`;
const title = "font-wide text-[clamp(1.6rem,2.6vw,2.25rem)] font-[880] leading-[1.05]";

/* ------------------------------------------------------------------ */
/* 2026                                                                */
/* ------------------------------------------------------------------ */

export function SeasonGame() {
	const { game } = season2026;
	const matchSeconds = game.phases.reduce((sum, p) => sum + p.seconds, 0);
	const maxPoints = Math.max(...game.scoring.map((s) => s.max));
	const phaseColors = ["bg-chart-1", "bg-chart-2", "bg-chart-3"];
	const before = (i: number) => game.phases.slice(0, i).reduce((sum, p) => sum + p.seconds, 0);
	return (
		<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div className="flex flex-col gap-4">
				<h4 className={title}>{t26.gameHeading}</h4>
				<p>{game.summary}</p>
				<p className="text-sm text-muted-foreground">
					{t26.seasonLabel} {game.season}
				</p>
				<figure className="m-0 flex flex-col gap-3 rounded-xl border surface p-4">
					<figcaption className="flex items-baseline justify-between gap-4">
						<span className="flex items-center gap-2 font-semibold">
							<Clock className="size-4" aria-hidden="true" /> {t26.matchHeading}
						</span>
						<span className="text-sm text-muted-foreground">{t26.matchLength}</span>
					</figcaption>
					{/* Proportional to seconds; each phase fills in turn, like the match clock (2.5 s for 2:30). */}
					<div className="flex h-3.5 gap-[2px]" aria-hidden="true">
						{game.phases.map((p, i) => (
							<span key={p.name} className="flex" style={{ flexGrow: p.seconds }}>
								<Grow className={cn("block w-full rounded-[4px]", phaseColors[i])} linear duration={(p.seconds / matchSeconds) * 2.5} delay={(before(i) / matchSeconds) * 2.5} />
							</span>
						))}
					</div>
					<ol className="flex flex-col gap-2.5">
						{game.phases.map((p, i) => (
							<li key={p.name} className="flex gap-2.5">
								<span aria-hidden="true" className={cn("mt-1.5 size-3 shrink-0 rounded-[3px]", phaseColors[i])} />
								<div>
									<p className="text-sm font-semibold">
										{p.name} <span className="font-normal text-muted-foreground">{p.time}</span>
									</p>
									<p className="text-[13px] leading-snug text-muted-foreground">{p.desc}</p>
								</div>
							</li>
						))}
					</ol>
				</figure>
			</div>
			<div className="flex flex-col gap-5">
				<figure className="m-0 flex flex-col gap-3 rounded-xl border surface p-4">
					<figcaption className="font-semibold">{t26.scoringHeading}</figcaption>
					<ul className="flex flex-col gap-3">
						{game.scoring.map((s, i) => (
							<li key={s.method} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1">
								<p className="text-sm font-medium">
									{s.method} <span className="font-normal text-muted-foreground">{s.note}</span>
								</p>
								<p className="row-span-2 text-right font-semibold tabular-nums">{s.points}</p>
								<span className="h-2 rounded-full bg-foreground/10" aria-hidden="true">
									<span className="block h-full" style={{ width: `${(s.max / maxPoints) * 100}%` }}>
										<Grow className="block h-full w-full rounded-[4px] bg-foreground" delay={i * 0.07} />
									</span>
								</span>
							</li>
						))}
					</ul>
					<p className="flex gap-2 border-t pt-3 text-sm text-muted-foreground">
						<Trophy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						{game.rankingPoints}
					</p>
				</figure>
				<a href={game.fieldImage} target="_blank" rel="noopener" aria-label={t26.fieldOpenLabel} className="group flex items-center gap-4 rounded-xl border surface p-3">
					<img src={game.fieldImage} alt={t26.fieldAlt} width={630} height={420} loading="lazy" decoding="async" className="h-20 w-auto rounded-md transition-transform duration-500 group-hover:scale-[1.04]" />
					<span className="flex flex-col gap-1 text-sm">
						<span className="font-semibold">{t26.fieldCaption}</span>
						<span className="inline-flex items-center gap-1 text-muted-foreground">
							<img src="/assets/FRC_logo.png" alt="FIRST" width="438" height="115" className="h-4 w-auto invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen" />
							<ArrowUpRight className="size-4" aria-hidden="true" />
						</span>
					</span>
				</a>
			</div>
		</div>
	);
}

/** The season from preseason to the second regional, the build season as strips, and what the season delivered. */
export function SeasonTimeline() {
	const steps = season2026.timeline;
	const [on, setOn] = useState(steps.length - 1);
	return (
		<div className="flex flex-col gap-4">
			<ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label={t26.timelineHeading}>
				{steps.map((s, i) => {
					const event = s.title.includes("Regional");
					return (
						<li key={s.title}>
							<button
								type="button"
								onMouseEnter={() => setOn(i)}
								onFocus={() => setOn(i)}
								onClick={() => setOn(i)}
								aria-pressed={on === i}
								className={cn("frc-pick flex size-full flex-col items-start gap-1 rounded-xl border p-3 text-left", on === i && "is-on")}
							>
								<span className="text-xs opacity-75">{s.when}</span>
								<span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
									{event && <Flag className="size-3.5 shrink-0 text-alliance-red" aria-hidden="true" />}
									{s.title}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
			<p className="min-h-[3rem]" aria-live="polite">
				<span className="font-semibold">{steps[on].title}.</span> <span className="text-muted-foreground">{steps[on].desc}</span>
			</p>
			<BuildStrips />
			<ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4" aria-label={t26.resultsHeading}>
				{season2026.achievements.map((a) => (
					<li key={a.title} className="flex gap-2.5 border-t py-2.5">
						<Trophy className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
						<span className="text-sm">
							<span className="font-semibold">{a.title}.</span> <span className="text-muted-foreground">{a.desc}</span>
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/** A row of prints that scrolls sideways; tap one to see it large. */
export function Filmstrip({ ids, label }: { ids: FrcPhotoId[]; label: string }) {
	const photos = ids.map((id) => frcPhotos[id] as FrcPhoto);
	const [viewing, setViewing] = useState<number | null>(null);
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const d = ref.current;
		if (!d) return;
		if (viewing !== null && !d.open) d.showModal();
		if (viewing === null && d.open) d.close();
	}, [viewing]);
	const step = (k: number) => viewing !== null && setViewing((viewing + k + photos.length) % photos.length);
	const p = viewing !== null ? photos[viewing] : undefined;
	return (
		<>
			<ul className="frc-film" aria-label={label}>
				{photos.map((ph, i) => (
					<li key={ph.id}>
						<figure className="m-0 flex h-full flex-col gap-2">
							<button type="button" onClick={() => setViewing(i)} className="group block flex-1 overflow-hidden rounded-xl" aria-label={`${lightboxText.open} ${ph.caption}`}>
								<img src={small(ph.id)} alt={ph.alt} width={ph.w} height={ph.h} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
							</button>
							<figcaption className="text-sm">
								<span className="font-medium">{ph.caption}</span>
								{ph.meta && <span className="text-muted-foreground"> · {ph.meta}</span>}
							</figcaption>
						</figure>
					</li>
				))}
			</ul>
			<dialog
				ref={ref}
				className="frc-lightbox"
				aria-label={p?.caption}
				onClose={() => setViewing(null)}
				onClick={(e) => e.target === e.currentTarget && setViewing(null)}
				onKeyDown={(e) => {
					if (e.key === "ArrowRight") step(1);
					if (e.key === "ArrowLeft") step(-1);
				}}
			>
				{p && (
					<figure className="m-0 flex max-h-full flex-col items-center gap-3">
						<img src={`/assets/frc/${p.id}.webp`} alt={p.alt} width={p.w} height={p.h} className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain" />
						<figcaption className="text-center text-white">
							{p.caption}
							{p.meta && <span className="text-white/70"> · {p.meta}</span>}
							<span className="text-white/70"> · {viewing! + 1} / {photos.length}</span>
						</figcaption>
					</figure>
				)}
				<button type="button" className="frc-lightbox-btn right-4 top-4" onClick={() => setViewing(null)} aria-label={lightboxText.close}>
					<X className="size-5" aria-hidden="true" />
				</button>
				<button type="button" className="frc-lightbox-btn left-4 top-1/2 -translate-y-1/2" onClick={() => step(-1)} aria-label={lightboxText.prev}>
					<ArrowRight className="size-5 rotate-180" aria-hidden="true" />
				</button>
				<button type="button" className="frc-lightbox-btn right-4 top-1/2 -translate-y-1/2" onClick={() => step(1)} aria-label={lightboxText.next}>
					<ArrowRight className="size-5" aria-hidden="true" />
				</button>
			</dialog>
		</>
	);
}

/* ------------------------------------------------------------------ */
/* The robot                                                           */
/* ------------------------------------------------------------------ */

/** The 2026 robot: photos, the four numbers and its philosophy; the specs and test results open in a drawer. */
export function KitBotView() {
	const { robot } = season2026;
	const reveal = frcPage.reveal;
	const [big, setBig] = useState(0);
	const drawer = useRef<HTMLDialogElement>(null);
	const photo = robot.photos[big];
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
			<figure className="m-0 flex flex-col gap-3">
				<div className="relative aspect-[3/2] overflow-hidden rounded-xl border bg-muted">
					<AnimatePresence initial={false}>
						<motion.img
							key={photo.src}
							src={photo.src}
							srcSet={srcset(photo.src)}
							sizes="(min-width: 1024px) 45vw, 100vw"
							alt={photo.alt}
							className="absolute inset-0 size-full object-cover"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.4 }}
						/>
					</AnimatePresence>
				</div>
				<ul className="flex gap-2" aria-label={board.kitbot.photosLabel}>
					{robot.photos.map((ph, i) => (
						<li key={ph.src}>
							<button type="button" onClick={() => setBig(i)} aria-pressed={big === i} aria-label={ph.caption} className={cn("block size-16 overflow-hidden rounded-lg border-2 transition-colors", big === i ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100")}>
								<img src={srcset(ph.src)?.split(" ")[0] ?? ph.src} alt="" className="size-full object-cover" loading="lazy" />
							</button>
						</li>
					))}
					<li className="ml-1 self-center text-sm text-muted-foreground">{photo.caption}</li>
				</ul>
			</figure>
			<div className="flex flex-col gap-4">
				<h4 className={title}>{reveal.heading}</h4>
				<p className="text-muted-foreground">{reveal.text}</p>
				<ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
					{reveal.highlights.map((h) => (
						<li key={h} className="flex items-center gap-2">
							<span aria-hidden="true" className="size-1.5 rounded-full bg-accent ring-1 ring-foreground/30" />
							{h}
						</li>
					))}
				</ul>
				<dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
					{robot.stats.map((s) => (
						<div key={s.label} className="flex flex-col gap-0.5 bg-card p-3">
							<dt className="order-2 text-xs text-muted-foreground">{s.label}</dt>
							<dd className="order-1 font-wide text-2xl font-[850] tabular-nums">
								{s.value}
								<span className="text-sm font-semibold text-muted-foreground">{s.suffix}</span>
							</dd>
						</div>
					))}
				</dl>
				<blockquote className="flex gap-3 border-l-4 border-accent pl-4">
					<Quote className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<p className="font-semiwide font-[650] leading-snug">{robot.philosophy}</p>
				</blockquote>
				<button type="button" onClick={() => drawer.current?.showModal()} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-fit")}>
					{board.kitbot.specsButton} <ArrowRight aria-hidden="true" />
				</button>
			</div>
			<dialog ref={drawer} className="frc-drawer" aria-labelledby="kitbot-specs" onClick={(e) => e.target === e.currentTarget && drawer.current?.close()}>
				<div className="flex flex-col gap-6">
					<div className="flex items-center justify-between gap-4">
						<h4 id="kitbot-specs" className="font-wide text-2xl font-[850]">
							{t26.robotHeading}
						</h4>
						<button type="button" onClick={() => drawer.current?.close()} className="frc-chip-btn" aria-label={board.kitbot.close}>
							<X className="size-4" aria-hidden="true" />
						</button>
					</div>
					{robot.specs.map((spec) => (
						<section key={spec.title} className="flex flex-col gap-2 border-t pt-4">
							<h5 className="flex items-center gap-2 font-semiwide text-lg font-[760]">
								<DataIcon name={spec.icon} className="size-5" strokeWidth={1.75} />
								{spec.title}
							</h5>
							<ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground marker:text-foreground/40">
								{spec.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</section>
					))}
					<section className="flex flex-col gap-4 border-t pt-4">
						<h5 className="font-semiwide text-lg font-[760]">{t26.testingHeading}</h5>
						{robot.metrics.map((m) => (
							<div key={m.label} className="flex flex-col gap-1.5">
								<p className="flex justify-between text-sm">
									<span>
										{m.label} <span className="text-muted-foreground">{m.detail}</span>
									</span>
									<span className="font-semibold tabular-nums">{m.value}%</span>
								</p>
								<span role="meter" aria-valuenow={m.value} aria-valuemin={0} aria-valuemax={100} aria-label={m.label} className="h-2 rounded-full bg-foreground/10">
									<span className="block h-full rounded-full bg-foreground" style={{ width: `${m.value}%` }} />
								</span>
							</div>
						))}
					</section>
				</div>
			</dialog>
		</div>
	);
}

/** Motors, the control stack and vision: pick a tab, then an item to read about it. */
export function HardwareView() {
	const groups = {
		motors: motors,
		control: controlStack,
		vision: vision,
	} as const;
	type Group = keyof typeof groups;
	const [group, setGroup] = useState<Group>("motors");
	const [on, setOn] = useState(0);
	const items: readonly HardwareItem[] = groups[group];
	const item = items[Math.min(on, items.length - 1)];
	return (
		<MotionConfig reducedMotion="user">
			<div className="flex flex-col gap-5">
				<p className="max-w-3xl text-muted-foreground">{hardwareText.intro}</p>
				<div className="flex gap-1.5" role="group" aria-label={hardwareText.heading}>
					{(Object.keys(groups) as Group[]).map((g) => (
						<button
							key={g}
							type="button"
							aria-pressed={group === g}
							onClick={() => {
								setGroup(g);
								setOn(0);
							}}
							className={cn("frc-pick rounded-full border px-4 text-sm font-semibold", group === g && "is-on")}
						>
							{board.hardware.tabs[g]}
						</button>
					))}
				</div>
				<div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
					<ul className="flex flex-col gap-1.5">
						{items.map((it, i) => (
							<li key={it.name}>
								<button type="button" aria-pressed={on === i} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(i)} className={cn("frc-pick flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left", on === i && "is-on")}>
									<span className="font-semibold">{it.name}</span>
									<span className="text-xs opacity-75">
										{it.maker}
										{it.legacy ? ` · ${hardwareText.legacyHeading}` : ""}
									</span>
								</button>
							</li>
						))}
					</ul>
					<div className="rounded-2xl border surface p-6" aria-live="polite">
						<AnimatePresence mode="wait" initial={false}>
							<motion.div key={item.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
								<p className="text-sm text-muted-foreground">{item.maker}</p>
								<h4 className={title}>{item.name}</h4>
								<p>{item.desc}</p>
								<ul className="flex flex-wrap gap-2">
									{item.specs.map((s) => (
										<li key={s.value + (s.label ?? "")} className="rounded-lg border bg-card px-2.5 py-1 text-sm">
											<span className="font-semibold">{s.value}</span>
											{s.label && <span className="text-muted-foreground"> {s.label}</span>}
										</li>
									))}
								</ul>
								{group === "control" && <p className="border-t pt-3 text-sm text-muted-foreground">{hardwareText.busCaption}</p>}
							</motion.div>
						</AnimatePresence>
					</div>
				</div>
			</div>
		</MotionConfig>
	);
}

/* ------------------------------------------------------------------ */
/* 2027                                                                */
/* ------------------------------------------------------------------ */

export function Overview2027() {
	const t = season2027More;
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			<div className="flex flex-col items-start gap-4">
				<span className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-card px-2.5 py-0.5 text-[13px] font-medium">
					<span className="size-2 rounded-full bg-accent ring-1 ring-foreground/25" aria-hidden="true" />
					{t27.liveTag}
				</span>
				<h4 className="font-wide text-[clamp(2rem,3.6vw,3.25rem)] font-[880] leading-[1]">{season2027.headline}</h4>
				<p>{season2027.intro}</p>
				<p className="text-muted-foreground">{t.regionalsIntro}</p>
				<div className="flex flex-wrap gap-3">
					<button type="button" data-email-open data-subject={t27.joinEmailSubject} className={buttonVariants({ variant: "signal", size: "lg" })}>
						<Mail aria-hidden="true" /> {t27.joinButton}
					</button>
					<a href="#2026" className={buttonVariants({ variant: "outline", size: "lg" })}>
						{t27.lookBackButton} <ArrowRight aria-hidden="true" />
					</a>
				</div>
			</div>
			<div className="flex flex-col gap-4">
				<Countdown />
				<ul className="grid gap-4 sm:grid-cols-2">
					{t.regionals.map((r) => (
						<li key={r.name} className="flex flex-col gap-1.5 rounded-xl border surface p-5">
							<p className="text-xs text-muted-foreground">{r.label}</p>
							<h5 className="font-semiwide text-xl font-[780]">{r.name}</h5>
							<p className="text-sm text-muted-foreground">
								{r.city} · {r.dates}
							</p>
							<p className="text-sm">{r.desc}</p>
							{r.km && (
								<p className="mt-auto pt-2 font-wide text-2xl font-[900] tabular-nums">
									{r.km.toLocaleString("en-US")} <span className="text-sm font-semibold text-muted-foreground">km</span>
								</p>
							)}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

/** The four steps to the 2027 regionals (hover or tap one), and what we're carrying forward. */
export function Road2027() {
	const steps = season2027.timeline;
	const [on, setOn] = useState(Math.max(0, steps.findIndex((s) => s.state === "current")));
	return (
		<div className="flex flex-col gap-6">
			<ol className="grid gap-2 sm:grid-cols-4" aria-label={t27.roadHeading}>
				{steps.map((s, i) => (
					<li key={s.title}>
						<button type="button" onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(i)} aria-pressed={on === i} className={cn("frc-pick flex size-full flex-col items-start gap-1 rounded-xl border p-4 text-left", on === i && "is-on")}>
							<span className="flex items-center gap-2 text-xs opacity-75">
								{s.when}
								{s.state === "current" && <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-foreground">{t27.nowTag}</span>}
							</span>
							<span className="font-semibold">{s.title}</span>
						</button>
					</li>
				))}
			</ol>
			<p className="min-h-[3.5rem] text-lg" aria-live="polite">
				{steps[on].desc}
			</p>
			<div className="flex flex-col gap-3">
				<h4 className="font-semiwide text-lg font-[760]">
					{t27.focusHeading} <span className="font-normal text-muted-foreground">{t27.focusIntro}</span>
				</h4>
				<ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
					{season2027.focus.map((f) => (
						<li key={f.title} className="flex gap-3 border-t py-3">
							<DataIcon name={f.icon} className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
							<span className="text-sm">
								<span className="font-semibold">{f.title}.</span> <span className="text-muted-foreground">{f.desc}</span>
							</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

export function Goals2027() {
	return (
		<ul className="grid gap-4 md:grid-cols-3">
			{season2027More.goals.map((g) => (
				<li key={g.title} className="flex flex-col gap-3 rounded-2xl border surface p-6">
					<p className="text-sm text-muted-foreground">{g.label}</p>
					<h4 className="font-wide text-2xl font-[850]">{g.title}</h4>
					<ul className="flex flex-col gap-2">
						{g.items.map((item) => (
							<li key={item} className="flex gap-2.5">
								<span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent ring-1 ring-foreground/30" />
								{item}
							</li>
						))}
					</ul>
				</li>
			))}
		</ul>
	);
}
