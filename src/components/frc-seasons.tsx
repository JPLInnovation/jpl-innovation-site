import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Clock, Flag, Quote, Trophy } from "lucide-react";
import { motion } from "motion/react";
import ContactDialog from "@/components/contact-dialog";
import { CountUp, Grow, Reveal } from "@/components/motion-primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { season2026, season2027 } from "@/data/frc";
import { DataIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Season = "2027" | "2026";

const sections2026 = [
	{ id: "s2026-game", label: "Game" },
	{ id: "s2026-timeline", label: "Timeline" },
	{ id: "s2026-robot", label: "Robot" },
	{ id: "s2026-results", label: "Results" },
];

/** Season switcher for the FRC page. Deep links: #2026, #2027, or a 2026 section like #s2026-robot. */
export default function FrcSeasons() {
	const [season, setSeason] = useState<Season>("2027");
	const tabsRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const hash = location.hash.slice(1);
		if (hash === "2026" || hash.startsWith("s2026")) {
			setSeason("2026");
			// Wait for the panel to be shown before scrolling to a section inside it.
			if (hash.startsWith("s2026")) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
		}
	}, []);

	const change = (value: string) => {
		setSeason(value as Season);
		history.replaceState(null, "", `#${value}`);
	};

	const showSeason = (value: Season) => {
		change(value);
		tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<Tabs value={season} onValueChange={change} className="gap-12" ref={tabsRef}>
			<TabsList
				aria-label="Choose a season"
				className="h-auto gap-1 rounded-xl p-1 group-data-[orientation=horizontal]/tabs:h-auto"
			>
				<SeasonTab value="2027" status={season2027.status} active={season === "2027"} />
				<SeasonTab value="2026" status={season2026.status} active={season === "2026"} />
			</TabsList>

			<TabsContent value="2027" forceMount className="data-[state=inactive]:hidden">
				<Panel active={season === "2027"}>
					<Season2027 onShow2026={showSeason} />
				</Panel>
			</TabsContent>
			<TabsContent value="2026" forceMount className="data-[state=inactive]:hidden">
				<Panel active={season === "2026"}>
					<Season2026 />
				</Panel>
			</TabsContent>
		</Tabs>
	);
}

/** Segmented-control tab. The pill slides between tabs on a spring (shared layoutId). */
function SeasonTab({ value, status, active }: { value: Season; status: string; active: boolean }) {
	return (
		<TabsTrigger
			value={value}
			className="press relative h-auto cursor-pointer flex-col items-start gap-0 rounded-lg px-5 py-2.5 text-left data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
		>
			{active && (
				<motion.span
					layoutId="season-pill"
					className="absolute inset-0 rounded-lg bg-background shadow-sm dark:bg-card"
					transition={{ type: "spring", bounce: 0, duration: 0.4 }}
				/>
			)}
			<span className="relative font-wide text-xl font-[850] leading-tight">{value}</span>
			<span className="relative text-[13px] font-medium text-muted-foreground">{status}</span>
		</TabsTrigger>
	);
}

/** Eases a season in when its tab is chosen; no animation on first load. */
function Panel({ active, children }: { active: boolean; children: ReactNode }) {
	return (
		<motion.div
			initial={false}
			animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
			transition={{ type: "spring", bounce: 0, duration: 0.6 }}
		>
			{children}
		</motion.div>
	);
}

/* ------------------------------------------------------------------ */
/* 2027                                                                */
/* ------------------------------------------------------------------ */

// Memoised so switching tabs doesn't re-render them (count-ups own their text after mount).
const Season2027 = memo(function Season2027({ onShow2026 }: { onShow2026: (season: Season) => void }) {
	return (
		<div className="flex flex-col gap-20">
			<div className="flex max-w-3xl flex-col items-start gap-5">
				<LiveTag>Preseason in progress</LiveTag>
				<h2 className="font-wide text-[clamp(2.2rem,5.5vw,4.25rem)] font-[880] leading-[1]">
					{season2027.headline}
				</h2>
				<p className="max-w-[60ch] text-lg">{season2027.intro}</p>
				<div className="flex flex-wrap gap-3 pt-2">
					<ContactDialog look="signal" label="Join or sponsor us" subject="FRC 2027: joining or sponsoring" />
					<Button variant="outline" size="lg" onClick={() => onShow2026("2026")}>
						Look back at 2026 <ArrowRight aria-hidden="true" />
					</Button>
				</div>
			</div>

			<section aria-labelledby="road-2027" className="flex flex-col gap-8">
				<h2 id="road-2027" className="font-wide text-3xl font-[850] md:text-4xl">
					Road to 2027
				</h2>
				<Reveal as="ol" className="grid gap-8 md:grid-cols-4 md:gap-6">
					{season2027.timeline.map((step) => {
						const now = step.state === "current";
						return (
							<li key={step.title} className="flex flex-col gap-2">
								<span aria-hidden="true" className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-foreground/15">
									{now && <Grow className="block h-full w-full rounded-full bg-accent" duration={1.4} />}
								</span>
								<p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									{step.when}
									{now && <NowTag />}
								</p>
								<h3 className="font-semiwide text-lg font-[760]">{step.title}</h3>
								<p className="text-muted-foreground">{step.desc}</p>
							</li>
						);
					})}
				</Reveal>
			</section>

			<section aria-labelledby="focus-2027" className="flex flex-col gap-8">
				<div className="flex flex-col gap-2">
					<h2 id="focus-2027" className="font-wide text-3xl font-[850] md:text-4xl">
						What we're building toward
					</h2>
					<p className="text-lg text-muted-foreground">Carried forward from our rookie year.</p>
				</div>
				<ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
					{season2027.focus.map((f, i) => (
						<Reveal as="li" delay={(i % 3) * 0.08} key={f.title} className="flex flex-col gap-2 border-t py-6">
							<DataIcon name={f.icon} className="size-6" strokeWidth={1.75} />
							<h3 className="font-semiwide text-lg font-[760]">{f.title}</h3>
							<p className="text-muted-foreground">{f.desc}</p>
						</Reveal>
					))}
				</ul>
			</section>
		</div>
	);
});

/* ------------------------------------------------------------------ */
/* 2026                                                                */
/* ------------------------------------------------------------------ */

const Season2026 = memo(function Season2026() {
	const { game, robot } = season2026;
	const matchSeconds = game.phases.reduce((sum, p) => sum + p.seconds, 0);
	const maxPoints = Math.max(...game.scoring.map((s) => s.max));
	const phaseColors = ["bg-chart-1", "bg-chart-2", "bg-chart-3"];
	const elapsedBefore = (i: number) => game.phases.slice(0, i).reduce((sum, p) => sum + p.seconds, 0);

	return (
		<div className="flex flex-col gap-24">
			<nav aria-label="2026 season sections" className="flex flex-wrap gap-2">
				{sections2026.map((s) => (
					<a
						key={s.id}
						href={`#${s.id}`}
						className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium hover:border-foreground/40"
					>
						{s.label}
					</a>
				))}
			</nav>

			{/* Game */}
			<section id="s2026-game" aria-labelledby="h-game" className="flex scroll-mt-24 flex-col gap-10">
				<div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
					<div className="flex flex-col gap-5">
						<h2 id="h-game" className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] font-[850]">
							The 2026 game: precision scoring
						</h2>
						<p className="text-lg">{game.summary}</p>
						<p className="text-sm text-muted-foreground">Competition season: {game.season}</p>
					</div>
					<figure className="flex flex-col gap-3">
						<a
							href={game.fieldImage}
							target="_blank"
							rel="noopener"
							className="group block overflow-hidden rounded-xl border surface"
							aria-label="Open the 2026 playing field image full size"
						>
							<img
								src={game.fieldImage}
								alt="Official 2026 FRC playing field layout"
								loading="lazy"
								className="w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
							/>
						</a>
						<figcaption className="flex items-center gap-3 text-sm text-muted-foreground">
							{/* White-on-black logo file: see the note in frc.astro. */}
							<img
								src="/assets/FRC_logo.png"
								alt="FIRST"
								width="438"
								height="115"
								className="h-5 w-auto invert mix-blend-multiply dark:invert-0 dark:mix-blend-screen"
							/>
							Official 2026 playing field
						</figcaption>
					</figure>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<figure className="flex flex-col gap-5 rounded-xl border surface p-6 md:p-8">
						<figcaption className="flex items-baseline justify-between gap-4">
							<h3 className="flex items-center gap-2 text-lg font-semibold">
								<Clock className="size-5" aria-hidden="true" /> Match structure
							</h3>
							<span className="text-sm text-muted-foreground">2:30 per match</span>
						</figcaption>
						{/* Proportional to seconds; each phase is also listed below with its time. */}
						{/* Each phase fills in turn at constant speed, like the match clock (2.5 s for 2:30). */}
						<div className="flex h-4 gap-[2px]" aria-hidden="true">
							{game.phases.map((p, i) => (
								<span key={p.name} className="flex" style={{ flexGrow: p.seconds }}>
									<Grow
										title={`${p.name}: ${p.time}`}
										className={cn("block w-full rounded-[4px]", phaseColors[i])}
										linear
										duration={(p.seconds / matchSeconds) * 2.5}
										delay={(elapsedBefore(i) / matchSeconds) * 2.5}
									/>
								</span>
							))}
						</div>
						<ol className="flex flex-col gap-4">
							{game.phases.map((p, i) => (
								<li key={p.name} className="flex gap-3">
									<span aria-hidden="true" className={cn("mt-1.5 size-3 shrink-0 rounded-[3px]", phaseColors[i])} />
									<div>
										<p className="font-semibold">
											{p.name} <span className="font-normal text-muted-foreground">{p.time}</span>
										</p>
										<p className="text-sm text-muted-foreground">{p.desc}</p>
									</div>
								</li>
							))}
						</ol>
						<p className="sr-only">Total match length {matchSeconds} seconds.</p>
					</figure>

					<figure className="flex flex-col gap-5 rounded-xl border surface p-6 md:p-8">
						<figcaption>
							<h3 className="text-lg font-semibold">Points per scoring action</h3>
						</figcaption>
						<ul className="flex flex-col gap-4">
							{game.scoring.map((s, i) => (
								<li key={s.method} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 gap-y-1.5">
									<p className="text-[15px] font-medium">
										{s.method} <span className="text-sm font-normal text-muted-foreground">{s.note}</span>
									</p>
									<p className="row-span-2 text-right font-semibold tabular-nums">{s.points}</p>
									<span className="h-2.5 rounded-full bg-foreground/10" aria-hidden="true">
										<span className="block h-full" style={{ width: `${(s.max / maxPoints) * 100}%` }}>
											<Grow className="block h-full w-full rounded-[4px] bg-foreground" delay={i * 0.07} />
										</span>
									</span>
								</li>
							))}
						</ul>
						<p className="flex gap-2 border-t pt-4 text-sm text-muted-foreground">
							<Trophy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							{game.rankingPoints}
						</p>
					</figure>
				</div>
			</section>

			{/* Timeline */}
			<section id="s2026-timeline" aria-labelledby="h-timeline" className="flex scroll-mt-24 flex-col gap-8">
				<h2 id="h-timeline" className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] font-[850]">
					From kickoff to competition
				</h2>
				<ol className="flex flex-col">
					{season2026.timeline.map((t) => {
						const event = t.title.includes("Regional");
						return (
							<Reveal as="li" key={t.title} className="grid gap-1 border-t py-5 md:grid-cols-[11rem_1fr] md:gap-8">
								<p className="text-sm font-medium text-muted-foreground md:pt-0.5">{t.when}</p>
								<div className="flex flex-col gap-1">
									<h3 className="flex items-center gap-2 font-semiwide text-lg font-[760]">
										{event && <Flag className="size-4 text-alliance-red" aria-label="Competition" />}
										{t.title}
									</h3>
									<p className="text-muted-foreground">{t.desc}</p>
								</div>
							</Reveal>
						);
					})}
				</ol>
			</section>

			{/* Robot */}
			<section id="s2026-robot" aria-labelledby="h-robot" className="flex scroll-mt-24 flex-col gap-10">
				<h2 id="h-robot" className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] font-[850]">
					Built for reliability
				</h2>
				<Reveal as="blockquote" className="flex max-w-4xl gap-4 border-l-4 border-accent pl-6">
					<Quote className="mt-1 size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
					<p className="font-semiwide text-[clamp(1.25rem,2.4vw,1.75rem)] font-[650] leading-snug">{robot.philosophy}</p>
				</Reveal>

				{/* The KitBot we built: front and field shots stacked on the left, the tall rear shot on the right. */}
				<ul aria-label="Photos of our 2026 KitBot" className="grid gap-4 md:grid-cols-[1.125fr_1fr] md:grid-rows-2">
					{robot.photos.map((photo, i) => (
						<Reveal
							as="li"
							delay={i * 0.08}
							key={photo.src}
							className={cn("min-h-0", i === 1 && "md:col-start-2 md:row-span-2 md:row-start-1")}
						>
							<figure className="flex h-full flex-col gap-2">
								<a
									href={photo.src}
									target="_blank"
									rel="noopener"
									className="group block min-h-0 flex-1 overflow-hidden rounded-xl border surface"
								>
									<img
										src={photo.src}
										alt={photo.alt}
										width={photo.w}
										height={photo.h}
										loading="lazy"
										decoding="async"
										className={cn(
											"size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
											i === 1 ? "aspect-[4/5] object-[50%_70%] md:aspect-auto" : "aspect-[3/2]",
										)}
									/>
								</a>
								<figcaption className="text-sm text-muted-foreground">{photo.caption}</figcaption>
							</figure>
						</Reveal>
					))}
				</ul>

				<dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-4">
					{robot.stats.map((s) => (
						<div key={s.label} className="flex flex-col gap-1 bg-card p-5 md:p-6">
							<dt className="order-2 text-sm text-muted-foreground">{s.label}</dt>
							<dd className="order-1 font-wide text-3xl font-[850] tabular-nums md:text-4xl">
								<CountUp value={s.value} />
								<span className="text-lg font-semibold text-muted-foreground">{s.suffix}</span>
							</dd>
						</div>
					))}
				</dl>

				<ul className="grid gap-x-10 md:grid-cols-2">
					{robot.specs.map((spec, i) => (
						<Reveal as="li" delay={(i % 2) * 0.08} key={spec.title} className="flex flex-col gap-3 border-t py-6">
							<h3 className="flex items-center gap-2.5 font-semiwide text-lg font-[760]">
								<DataIcon name={spec.icon} className="size-5" strokeWidth={1.75} />
								{spec.title}
							</h3>
							<ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground marker:text-foreground/40">
								{spec.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</Reveal>
					))}
				</ul>

				<figure className="flex flex-col gap-5 rounded-xl border surface p-6 md:p-8">
					<figcaption>
						<h3 className="text-lg font-semibold">Performance in testing</h3>
					</figcaption>
					<ul className="grid gap-6 md:grid-cols-3">
						{robot.metrics.map((m) => (
							<li key={m.label} className="flex flex-col gap-2">
								<p className="font-wide text-3xl font-[850] tabular-nums">
									<CountUp value={m.value} suffix="%" />
								</p>
								<span
									role="meter"
									aria-valuenow={m.value}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label={m.label}
									className="h-2.5 rounded-full bg-foreground/10"
								>
									<span className="block h-full" style={{ width: `${m.value}%` }}>
										<Grow className="block h-full w-full rounded-[4px] bg-foreground" duration={1.4} />
									</span>
								</span>
								<p className="text-[15px] font-medium">
									{m.label} <span className="font-normal text-muted-foreground">{m.detail}</span>
								</p>
							</li>
						))}
					</ul>
				</figure>
			</section>

			{/* Results */}
			<section id="s2026-results" aria-labelledby="h-results" className="flex scroll-mt-24 flex-col gap-10">
				<h2 id="h-results" className="font-wide text-[clamp(2rem,4.5vw,3.25rem)] font-[850]">
					What our rookie season delivered
				</h2>
				<ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
					{season2026.achievements.map((a, i) => (
						<Reveal as="li" delay={i * 0.08} key={a.title} className="flex flex-col gap-2 border-t py-6">
							<Trophy className="size-5" strokeWidth={1.75} aria-hidden="true" />
							<h3 className="font-semiwide text-lg font-[760]">{a.title}</h3>
							<p className="text-muted-foreground">{a.desc}</p>
						</Reveal>
					))}
				</ul>
				<ul className="grid gap-6 md:grid-cols-2">
					{season2026.competitions.map((c, i) => (
						<Reveal as="li" delay={i * 0.1} key={c.code} className="flex flex-col gap-4 rounded-xl border surface p-6 md:p-8">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h3 className="font-semiwide text-xl font-[780]">{c.name}</h3>
									<p className="text-sm text-muted-foreground">{c.city}</p>
									<p className="text-sm text-muted-foreground">{c.dates}</p>
								</div>
								<span aria-hidden="true" className="font-wide text-3xl font-[900] text-foreground/20">
									{c.code}
								</span>
							</div>
							<h4 className="text-sm font-semibold">Goals</h4>
							<ul className="flex flex-col gap-2">
								{c.goals.map((g) => (
									<li key={g} className="flex gap-2.5">
										<span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent ring-1 ring-foreground/30" />
										{g}
									</li>
								))}
							</ul>
						</Reveal>
					))}
				</ul>
			</section>
		</div>
	);
});

function LiveTag({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex w-fit items-center gap-2 rounded-full border border-foreground/15 bg-card px-2.5 py-0.5 text-[13px] font-medium">
			<span className="size-2 rounded-full bg-accent ring-1 ring-foreground/25" aria-hidden="true" />
			{children}
		</span>
	);
}

function NowTag() {
	return <span className="rounded-sm bg-accent px-1.5 py-0.5 text-xs font-bold text-accent-foreground">Now</span>;
}
