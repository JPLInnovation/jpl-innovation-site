/**
 * The FRC page's team photos (public/assets/frc/, words and captions: src/text/projects/frc.ts `frcPhotos`):
 *
 *   - PhotoDeck     a stack of prints: drag or flick the top one away and it goes to the back; tap one to see it large
 *   - BuildStrips   the build season as tall strips side by side; the one you hover, focus or tap opens wide
 *   - EventSheets   the two rookie regionals as tabs: the photo crossfades, and the rank shows among the whole field
 *   - Countdown     days, hours and minutes until the next regional's first day
 *   - WeekPosts     the preseason week by week, newest first; tap a post's photo to flip to the next one
 *
 * Every photo opens in one viewer (the browser's own <dialog>: Escape closes it, focus stays inside). With reduced
 * motion nothing flies, tilts or crossfades; everything still works by button and keyboard.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
	frcDeck,
	frcPhotos,
	lightboxText,
	rookieText,
	season2026,
	season2027More,
	type FrcPhoto,
	type FrcPhotoId,
} from "@/text/projects/frc";
import { cn } from "@/lib/utils";

const full = (id: string) => `/assets/frc/${id}.webp`;
const small = (id: string) => `/assets/frc/${id}-640.webp`;
const srcSet = (photo: FrcPhoto) => `${small(photo.id)} 640w, ${full(photo.id)} ${photo.w}w`;
const pick = (ids: FrcPhotoId[]) => ids.map((id) => frcPhotos[id] as FrcPhoto);
/** A fixed small tilt per photo (so the server and the browser agree), between -3 and 3 degrees. */
const tilt = (id: string) => ((([...id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 13) + 13) % 13) / 2 - 3;

/* ------------------------------------------------------------------ */
/* The viewer                                                          */
/* ------------------------------------------------------------------ */

function Lightbox({ photos, index, onIndex }: { photos: FrcPhoto[]; index: number | null; onIndex: (i: number | null) => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	const open = index !== null;
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);
	const step = (d: number) => index !== null && onIndex((index + d + photos.length) % photos.length);
	const photo = index !== null ? photos[index] : undefined;
	return (
		<dialog
			ref={ref}
			className="frc-lightbox"
			aria-label={photo?.caption}
			onClose={() => onIndex(null)}
			onClick={(e) => e.target === e.currentTarget && onIndex(null)}
			onKeyDown={(e) => {
				if (e.key === "ArrowRight") step(1);
				if (e.key === "ArrowLeft") step(-1);
			}}
		>
			{photo && (
				<figure className="flex max-h-full flex-col items-center gap-3">
					<img src={full(photo.id)} alt={photo.alt} width={photo.w} height={photo.h} className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain" />
					<figcaption className="flex flex-wrap items-baseline justify-center gap-x-3 text-center text-white">
						<span className="font-medium">{photo.caption}</span>
						{photo.meta && <span className="font-mono text-xs uppercase tracking-wider text-white/70">{photo.meta}</span>}
						<span className="font-mono text-xs text-white/70">
							{index! + 1} / {photos.length}
						</span>
					</figcaption>
				</figure>
			)}
			<button type="button" className="frc-lightbox-btn right-4 top-4" onClick={() => onIndex(null)} aria-label={lightboxText.close}>
				<X className="size-5" aria-hidden="true" />
			</button>
			{photos.length > 1 && (
				<>
					<button type="button" className="frc-lightbox-btn left-4 top-1/2 -translate-y-1/2" onClick={() => step(-1)} aria-label={lightboxText.prev}>
						<ChevronLeft className="size-5" aria-hidden="true" />
					</button>
					<button type="button" className="frc-lightbox-btn right-4 top-1/2 -translate-y-1/2" onClick={() => step(1)} aria-label={lightboxText.next}>
						<ChevronRight className="size-5" aria-hidden="true" />
					</button>
				</>
			)}
		</dialog>
	);
}

/* ------------------------------------------------------------------ */
/* The deck                                                            */
/* ------------------------------------------------------------------ */

const FLING = 110; // px dragged, or
const FLICK = 520; // px/s, to send the top print to the back

export function PhotoDeck() {
	const photos = pick(frcDeck.photos);
	// order[0] is the print on top.
	const [order, setOrder] = useState(() => photos.map((_, i) => i));
	const [viewing, setViewing] = useState<number | null>(null);
	const reduce = useReducedMotion();
	const top = order[0];
	const cycle = (d: 1 | -1) => setOrder((o) => (d === 1 ? [...o.slice(1), o[0]] : [o[o.length - 1], ...o.slice(0, -1)]));
	return (
		<MotionConfig reducedMotion="user">
			<div className="flex flex-col items-center gap-6">
				<div className="relative aspect-[4/3] w-full max-w-[34rem]" aria-roledescription="carousel" aria-label={frcDeck.heading}>
					{order
						.slice()
						.reverse()
						.map((i) => (
							<DeckCard
								key={photos[i].id}
								photo={photos[i]}
								depth={order.indexOf(i)}
								onFling={() => cycle(1)}
								onOpen={() => setViewing(i)}
								still={!!reduce}
							/>
						))}
				</div>
				<div className="flex items-center gap-4">
					<button type="button" onClick={() => cycle(-1)} className="frc-round-btn" aria-label={frcDeck.prev}>
						<ArrowLeft className="size-4" aria-hidden="true" />
					</button>
					<p className="min-w-[4.5rem] text-center font-mono text-sm tabular-nums" aria-live="polite">
						{String(top + 1).padStart(2, "0")} / {String(order.length).padStart(2, "0")}
					</p>
					<button type="button" onClick={() => cycle(1)} className="frc-round-btn" aria-label={frcDeck.next}>
						<ArrowRight className="size-4" aria-hidden="true" />
					</button>
				</div>
				<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{frcDeck.hint}</p>
			</div>
			<Lightbox photos={photos} index={viewing} onIndex={setViewing} />
		</MotionConfig>
	);
}

function DeckCard({ photo, depth, onFling, onOpen, still }: { photo: FrcPhoto; depth: number; onFling: () => void; onOpen: () => void; still: boolean }) {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-300, 300], [-14, 14]);
	const isTop = depth === 0;
	const settle = { type: "spring", stiffness: 260, damping: 26 } as const;
	const end = (_: unknown, info: PanInfo) => {
		if (Math.abs(info.offset.x) > FLING || Math.abs(info.velocity.x) > FLICK) {
			// Off to the side it was thrown, then back in at the bottom of the stack.
			const away = Math.sign(info.offset.x || info.velocity.x) * 520;
			animate(x, away, { duration: 0.22 }).then(() => {
				onFling();
				x.set(0);
			});
		} else animate(x, 0, settle);
	};
	return (
		<motion.figure
			className={cn("absolute inset-0 m-0 select-none", isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none")}
			style={{ x, rotate: isTop ? rotate : 0, zIndex: 20 - depth }}
			initial={false}
			animate={{ scale: 1 - Math.min(depth, 4) * 0.04, y: Math.min(depth, 4) * -14, rotate: isTop ? undefined : tilt(photo.id) * (depth % 2 ? 1 : -1), opacity: depth > 4 ? 0 : 1 }}
			transition={settle}
			drag={isTop && !still ? "x" : false}
			dragMomentum={false}
			onDragEnd={end}
			aria-hidden={!isTop}
		>
			<button type="button" onClick={onOpen} tabIndex={isTop ? 0 : -1} className="frc-print block size-full overflow-hidden" aria-label={`${lightboxText.open} ${photo.caption}`}>
				<img src={small(photo.id)} srcSet={srcSet(photo)} sizes="(min-width: 640px) 34rem, 92vw" alt="" draggable={false} width={photo.w} height={photo.h} className="size-full object-cover" />
			</button>
			<figcaption className={cn("frc-print-caption", !isTop && "invisible")}>
				<span className="font-semibold">{photo.caption}</span>
				{photo.meta && <span className="font-mono text-[11px] uppercase tracking-wider opacity-75">{photo.meta}</span>}
			</figcaption>
		</motion.figure>
	);
}

/* ------------------------------------------------------------------ */
/* The build season strips                                             */
/* ------------------------------------------------------------------ */

export function BuildStrips() {
	const photos = pick(rookieText.build);
	const [open, setOpen] = useState(1);
	const [viewing, setViewing] = useState<number | null>(null);
	return (
		<>
			<ul className="frc-strips" aria-label={rookieText.buildHeading}>
				{photos.map((photo, i) => (
					<li key={photo.id} data-open={open === i ? "" : undefined} onMouseEnter={() => setOpen(i)}>
						<button
							type="button"
							className="relative block size-full overflow-hidden rounded-xl text-left"
							onFocus={() => setOpen(i)}
							onClick={() => (open === i ? setViewing(i) : setOpen(i))}
							aria-label={`${photo.meta}: ${photo.caption}`}
							aria-expanded={open === i}
						>
							<img src={small(photo.id)} srcSet={srcSet(photo)} sizes="(min-width: 768px) 50vw, 92vw" alt={photo.alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
							<span className="frc-strip-label">
								<span className="font-mono text-[11px] uppercase tracking-wider">{photo.meta}</span>
								<span className="frc-strip-caption font-semibold">{photo.caption}</span>
							</span>
						</button>
					</li>
				))}
			</ul>
			<Lightbox photos={photos} index={viewing} onIndex={setViewing} />
		</>
	);
}

/* ------------------------------------------------------------------ */
/* The two rookie regionals                                            */
/* ------------------------------------------------------------------ */

export function EventSheets() {
	const events = season2026.competitions;
	const [active, setActive] = useState(0);
	const tabs = useRef<(HTMLButtonElement | null)[]>([]);
	const e = events[active];
	const t = rookieText;
	const photo = frcPhotos[e.photo as FrcPhotoId] as FrcPhoto;
	const onKey = (ev: React.KeyboardEvent) => {
		const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
		if (!d) return;
		const next = (active + d + events.length) % events.length;
		setActive(next);
		tabs.current[next]?.focus();
	};
	return (
		<MotionConfig reducedMotion="user">
			<div className="flex flex-col">
				<div role="tabpanel" id="ev-panel" aria-labelledby={`ev-tab-${e.key}`} className="grid overflow-hidden rounded-2xl border surface lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
					<figure className="relative m-0 aspect-[4/3] overflow-hidden bg-muted lg:aspect-auto lg:min-h-[22rem]">
						<AnimatePresence initial={false}>
							<motion.img
								key={photo.id}
								src={small(photo.id)}
								srcSet={srcSet(photo)}
								sizes="(min-width: 1024px) 50vw, 100vw"
								alt={photo.alt}
								className="absolute inset-0 size-full object-cover"
								initial={{ opacity: 0, scale: 1.04 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.6 }}
							/>
						</AnimatePresence>
						<figcaption className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/75 to-transparent px-5 pb-4 pt-12 font-mono text-xs uppercase tracking-wider text-white">
							<span>
								{photo.caption} · {e.tab}
							</span>
							<span>2026</span>
						</figcaption>
					</figure>
					<div className="flex flex-col gap-3.5 p-5 md:p-6">
						<div>
							<div className="mb-1 flex flex-wrap items-center justify-between gap-2">
								<p className="text-sm text-muted-foreground">{e.city}</p>
								<div role="tablist" aria-label={t.eventsLabel} className="flex w-fit gap-1 rounded-xl border bg-card p-1" onKeyDown={onKey}>
									{events.map((ev, i) => (
										<button
											key={ev.key}
											ref={(el) => {
												tabs.current[i] = el;
											}}
											role="tab"
											id={`ev-tab-${ev.key}`}
											aria-selected={active === i}
											aria-controls="ev-panel"
											tabIndex={active === i ? 0 : -1}
											onClick={() => setActive(i)}
											className={cn("min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors", active === i ? "bg-foreground text-background" : "hover:bg-foreground/5")}
										>
											{ev.tab}
										</button>
									))}
								</div>
							</div>
							<h3 className="font-wide text-[clamp(1.4rem,2.2vw,1.9rem)] font-[850] leading-tight">{e.name}</h3>
							<p className="text-sm text-muted-foreground">
								{e.venue} · {e.dates}
							</p>
						</div>
						<dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
							<Stat label={t.rankLabel} value={<>{e.rank}<span className="text-lg text-muted-foreground"> / {e.of}</span></>} />
							<Stat label={t.qualLabel} value={e.qual} note={`${t.overallLabel}: ${e.overall}`} />
							<Stat label={t.allianceLabel} value={`${e.alliance}`} note={t.allianceValue} />
							<Stat label={t.kmLabel} value={`${e.km.toLocaleString("en-US")} km`} note={t.kmNote} />
						</dl>
						<RankStrip rank={e.rank} of={e.of} />
						<div className="flex flex-wrap items-center gap-2">
							<h4 className="mr-1 text-sm font-semibold">{t.playoffsHeading}</h4>
							<ol className="flex flex-wrap gap-2">
								{e.playoffs.map((m, i) => {
									const won = m.us > m.them;
									return (
										<li key={i} className={cn("rounded-lg border px-2.5 py-1 font-mono text-sm tabular-nums", won && "border-foreground bg-foreground text-background")}>
											{won ? t.playoffWin : t.playoffLoss} {m.us}–{m.them}
										</li>
									);
								})}
							</ol>
						</div>
						<p className="text-[15px]">{e.note}</p>
						<div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
						<details className="text-sm">
							<summary className="cursor-pointer font-semibold">{t.goalsHeading}</summary>
							<ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
								{e.goals.map((g) => (
									<li key={g}>{g}</li>
								))}
							</ul>
						</details>
						<a href={t.sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-semibold underline underline-offset-4">
							{t.sourceLink} <ArrowUpRight className="size-4" aria-hidden="true" />
						</a>
						</div>
					</div>
				</div>
			</div>
		</MotionConfig>
	);
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
	return (
		<div className="flex flex-col gap-0.5 bg-card px-4 py-3">
			<dt className="order-2 text-xs text-muted-foreground">
				{label}
				{note && <span className="block">{note}</span>}
			</dt>
			<dd className="order-1 font-wide text-xl font-[850] tabular-nums sm:text-2xl">{value}</dd>
		</div>
	);
}

/** The whole field in rank order, one mark per team; ours is lit, and the marks fill in up to it. */
function RankStrip({ rank, of }: { rank: number; of: number }) {
	const reduce = useReducedMotion();
	return (
		<figure className="m-0 flex flex-col gap-2">
			<div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
				{Array.from({ length: of }, (_, i) => (
					<motion.span
						key={`${of}-${i}`}
						className={cn("flex-1 rounded-[2px]", i + 1 === rank ? "bg-accent ring-1 ring-foreground/40" : "bg-foreground/20")}
						initial={reduce ? false : { height: "20%" }}
						animate={{ height: i + 1 === rank ? "100%" : i + 1 < rank ? "55%" : "35%" }}
						transition={{ delay: reduce ? 0 : i * 0.012, type: "spring", bounce: 0, duration: 0.5 }}
					/>
				))}
			</div>
			<figcaption className="flex justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
				<span>1</span>
				<span>
					{rookieText.fieldLabel} · {rookieText.us}: {rank}
				</span>
				<span>{of}</span>
			</figcaption>
		</figure>
	);
}

/* ------------------------------------------------------------------ */
/* The countdown                                                       */
/* ------------------------------------------------------------------ */

export function Countdown() {
	const t = season2027More;
	// The next regional that hasn't started; worked out in the browser (the page is built ahead of time).
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(id);
	}, []);
	const next = t.regionals.find((r) => now === null || Date.parse(r.startsAt) > now) ?? t.regionals[t.regionals.length - 1];
	const left = now === null ? null : Math.max(0, Date.parse(next.startsAt) - now);
	const parts = left === null ? null : { d: Math.floor(left / 864e5), h: Math.floor(left / 36e5) % 24, m: Math.floor(left / 6e4) % 60 };
	return (
		<div className="flex flex-col gap-4 rounded-2xl border surface p-5">
			<div className="flex flex-col gap-1">
				<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t.nextLabel}</p>
				<p className="font-wide text-2xl font-[850]">{next.name}</p>
				<p className="text-sm text-muted-foreground">
					{next.city} · {next.dates}
				</p>
				<a href={t.followHref} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold underline underline-offset-4">
					{t.followLink} <ArrowUpRight className="size-4" aria-hidden="true" />
				</a>
			</div>
			<div className="flex flex-col gap-1">
				<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t.untilLabel}</p>
				<p className="flex gap-4" role="timer" aria-live="off">
					{(["d", "h", "m"] as const).map((k) => (
						<span key={k} className="flex flex-col items-center">
							<span className="min-w-[3ch] text-center font-wide text-4xl font-[900] tabular-nums">{parts ? String(parts[k]).padStart(k === "d" ? 3 : 2, "0") : "–"}</span>
							<span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{t.units[k]}</span>
						</span>
					))}
				</p>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* The preseason, week by week                                         */
/* ------------------------------------------------------------------ */

export function WeekPosts() {
	const t = season2027More;
	const row = useRef<HTMLUListElement>(null);
	const scroll = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
	return (
		<div className="flex flex-col gap-4">
			<ul ref={row} className="frc-posts" aria-label={t.weeksHeading}>
				{t.weeks.map((w) => (
					<WeekPost key={w.week} week={w} />
				))}
			</ul>
			<div className="flex items-center gap-3">
				<button type="button" onClick={() => scroll(-1)} className="frc-round-btn" aria-label={lightboxText.prev}>
					<ArrowLeft className="size-4" aria-hidden="true" />
				</button>
				<button type="button" onClick={() => scroll(1)} className="frc-round-btn" aria-label={lightboxText.next}>
					<ArrowRight className="size-4" aria-hidden="true" />
				</button>
				<a href={t.instagramHref} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
					{t.instagramLabel} <ArrowUpRight className="size-4" aria-hidden="true" />
				</a>
			</div>
		</div>
	);
}

function WeekPost({ week }: { week: (typeof season2027More.weeks)[number] }) {
	const t = season2027More;
	const [shown, setShown] = useState(0);
	const id = (k: number) => `w${week.week}-${k}`;
	return (
		<li className="frc-post">
			<button
				type="button"
				onClick={() => setShown((s) => (s + 1) % week.photos)}
				className="relative block aspect-square w-full overflow-hidden rounded-t-xl bg-muted"
				aria-label={`${t.weekLabel} ${week.week}: ${t.weeksPhoto} ${shown + 1} / ${week.photos}`}
			>
				{/* Only the photo shown and the next one are in the page, so a week loads one photo at a time. */}
				{Array.from({ length: week.photos }, (_, k) => k).filter((k) => k === shown || k === (shown + 1) % week.photos).map((k) => (
					<img
						key={k}
						src={small(id(k))}
						alt=""
						loading="lazy"
						decoding="async"
						className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none", k === shown ? "opacity-100" : "opacity-0")}
					/>
				))}
				<span className="absolute inset-x-0 top-2 flex justify-center gap-1" aria-hidden="true">
					{Array.from({ length: week.photos }, (_, k) => (
						<span key={k} className={cn("h-1 w-6 rounded-full", k === shown ? "bg-white" : "bg-white/45")} />
					))}
				</span>
			</button>
			<div className="flex flex-col gap-1 p-4">
				<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
					{t.weekLabel} {week.week} · {week.dates}
				</p>
				<p className="text-[15px]">{week.text}</p>
			</div>
		</li>
	);
}
