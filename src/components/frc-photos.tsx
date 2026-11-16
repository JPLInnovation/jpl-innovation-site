/**
 * The FRC page's team photos (public/assets/frc/, words and captions: src/text/projects/frc.ts `frcPhotos`):
 *
 *   - PhotoDeck     a stack of prints: drag or flick the top one away and it goes to the back; tap one to see it large
 *   - BuildStrips   the build season as tall strips side by side; the one you hover, focus or tap opens wide
 *   - EventSheets   the two rookie regionals as tabs: the photo crossfades, and the rank shows on a starting grid of the whole field
 *   - Countdown     days, hours and minutes until the next regional's first day
 *   - WeekPosts     the preseason week by week, newest first; tap a post's photo to flip to the next one
 *
 * Every photo opens in one viewer (the browser's own <dialog>: Escape closes it, focus stays inside). With reduced
 * motion nothing flies, tilts or crossfades; everything still works by button and keyboard.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { gridSlots } from "@/lib/look/frc-race";
import {
	edition,
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
						{photo.meta && <span className="text-[13px] text-white/70">{photo.meta}</span>}
						<span className="text-[13px] text-white/70">
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
					<p className="min-w-[4.5rem] text-center text-sm tabular-nums" aria-live="polite">
						{String(top + 1).padStart(2, "0")} / {String(order.length).padStart(2, "0")}
					</p>
					<button type="button" onClick={() => cycle(1)} className="frc-round-btn" aria-label={frcDeck.next}>
						<ArrowRight className="size-4" aria-hidden="true" />
					</button>
				</div>
				<p className="text-[13px] text-muted-foreground">{frcDeck.hint}</p>
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
				{photo.meta && <span className="text-[13px] opacity-75">{photo.meta}</span>}
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
								<span className="text-[13px]">{photo.meta}</span>
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
			<div className="frc-ev">
				{/* The two cities, huge: the one picked in yellow. */}
				<div role="tablist" aria-label={t.eventsLabel} className="frc-ev-tabs" onKeyDown={onKey}>
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
							className="frc-ev-tab"
						>
							{ev.tab}
						</button>
					))}
				</div>
				<div role="tabpanel" id="ev-panel" aria-labelledby={`ev-tab-${e.key}`} className="frc-ev-panel">
					<div className="frc-ev-top">
						<div className="frc-ev-name">
							<p className="frc-ev-city">{e.city}</p>
							<h3>{e.name}</h3>
							<p className="frc-ev-meta">
								{e.venue} · {e.dates}
							</p>
							<p className="frc-ev-note">{e.note}</p>
						</div>
						<figure className="frc-ev-photo">
							<AnimatePresence initial={false}>
								<motion.img
									key={photo.id}
									src={small(photo.id)}
									srcSet={srcSet(photo)}
									sizes="(min-width: 1024px) 40vw, 100vw"
									alt={photo.alt}
									data-zoom={full(photo.id)}
									data-zoom-alt={photo.alt}
									data-zoom-caption={`${photo.caption}${photo.meta ? ` · ${photo.meta}` : ""}`}
									role="button"
									tabIndex={0}
									aria-label={`${lightboxText.open} ${photo.caption}`}
									className="frc-zoom-img absolute inset-0 size-full object-cover"
									initial={{ opacity: 0, scale: 1.04 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.6 }}
								/>
							</AnimatePresence>
							<figcaption>
								{photo.caption} · {e.tab} · 2026
							</figcaption>
						</figure>
					</div>
					<dl className="frc-ev-stats">
						<Stat label={t.rankLabel} value={<>{e.rank}<small> / {e.of}</small></>} />
						<Stat label={t.qualLabel} value={e.qual} note={`${t.overallLabel}: ${e.overall}`} />
						<Stat label={t.allianceLabel} value={`${e.alliance}`} note={t.allianceValue} />
						<Stat label={t.kmLabel} value={<>{e.km.toLocaleString("en-US")}<small> km</small></>} note={t.kmNote} />
					</dl>
					<StartingGrid key={e.key} rank={e.rank} of={e.of} alliance={e.alliance} />
					<div className="frc-ev-low">
						<div className="frc-ev-playoffs">
							<h4>{t.playoffsHeading}</h4>
							<ol>
								{e.playoffs.map((m, i) => {
									const won = m.us > m.them;
									return (
										<li key={i} data-won={won ? "" : undefined}>
											{won ? t.playoffWin : t.playoffLoss} {m.us}–{m.them}
										</li>
									);
								})}
							</ol>
						</div>
						<details className="frc-ev-goals">
							<summary>{t.goalsHeading}</summary>
							<ul>
								{e.goals.map((g) => (
									<li key={g}>{g}</li>
								))}
							</ul>
						</details>
						<a href={t.sourceHref} target="_blank" rel="noopener noreferrer" className="frc-ev-source">
							{t.sourceLink} <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden="true" />
						</a>
					</div>
				</div>
			</div>
		</MotionConfig>
	);
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
	return (
		<div>
			<dt>
				{label}
				{note && <span>{note}</span>}
			</dt>
			<dd>{value}</dd>
		</div>
	);
}

/**
 * The starting grid: the whole field in qualification order, two by two like a race grid, every slot above ours
 * filled, ours lit in yellow with the first-round pick beside it. The slots come in from the front of the grid back.
 */
function StartingGrid({ rank, of, alliance }: { rank: number; of: number; alliance: number }) {
	const reduce = useReducedMotion();
	const t = rookieText;
	return (
		<figure className="frc-grid" aria-label={`${t.fieldLabel} · ${t.us}: ${rank} / ${of}`}>
			<figcaption className="frc-grid-head">
				<span>{edition.gridHeading}</span>
				<span className="frc-grid-q">
					<span>
						{edition.gridPlace}
						{rank}
					</span>
					<b>
						{edition.firstRoundPick} · {t.allianceLabel} {alliance}
					</b>
				</span>
			</figcaption>
			<ol className="frc-grid-slots" aria-hidden="true">
				{gridSlots(rank, of).map((s, i) => (
					<motion.li
						key={s.p}
						data-kind={s.kind}
						initial={reduce ? false : { opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: reduce ? 0 : 0.15 + i * 0.016, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
					>
						<i>{s.p}</i>
						{s.kind === "us" && <span>10951 · P{s.p}</span>}
					</motion.li>
				))}
			</ol>
			<p className="frc-grid-key" aria-hidden="true">
				<span data-kind="above">{edition.gridAbove}</span>
				<span data-kind="us">{t.us}</span>
				<span data-kind="below">{edition.gridBelow}</span>
			</p>
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
				<p className="text-[13px] text-muted-foreground">{t.nextLabel}</p>
				<p className="font-wide text-2xl font-[850]">{next.name}</p>
				<p className="text-sm text-muted-foreground">
					{next.city} · {next.dates}
				</p>
				<a href={t.followHref} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold underline underline-offset-4">
					{t.followLink} <ArrowUpRight className="size-4" aria-hidden="true" />
				</a>
			</div>
			<div className="flex flex-col gap-1">
				<p className="text-[13px] text-muted-foreground">{t.untilLabel}</p>
				<p className="flex gap-4" role="timer" aria-live="off">
					{(["d", "h", "m"] as const).map((k) => (
						<span key={k} className="flex flex-col items-center">
							<span className="min-w-[3ch] text-center font-wide text-4xl font-[900] tabular-nums">{parts ? String(parts[k]).padStart(k === "d" ? 3 : 2, "0") : "–"}</span>
							<span className="text-[13px] text-muted-foreground">{t.units[k]}</span>
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
				<p className="text-[13px] text-muted-foreground">
					{t.weekLabel} {week.week} · {week.dates}
				</p>
				<p className="text-[15px]">{week.text}</p>
			</div>
		</li>
	);
}
