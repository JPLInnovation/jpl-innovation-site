/**
 * The FRC page's interactive storytelling (words: src/text/projects/frc.ts):
 *
 *   - SeasonStory      the rookie season in eight scenes. The text scrolls by on one side while the stage beside it
 *                      holds still: the photo crossfades and slowly settles, the big figure counts up, and the flight
 *                      path on the map draws to the next city. Without JavaScript every scene is plain text.
 *   - SwerveLab        a top-view swerve drive simulator you can drive (point or tap, W A S D, Q and E), next to the
 *                      real chassis photo; a marker on the photo lights the matching module in the simulator.
 *   - SubTeamPicker    point at, focus or tap a sub-team to see what it owns and its first jobs this season.
 *   - CertPipeline     the workshop's certification path, step by step (buttons or arrow keys), and a checklist to tick.
 *   - SupportPicker    point at or tap a kind of support to see what it makes possible.
 *
 * Reduced motion: nothing crossfades, counts or drives itself; the simulator moves only when it is driven.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, RotateCw } from "lucide-react";
import { frcPhotos, partner, seasonStory, swerveSim, teamMore, workshop, type FrcPhoto } from "@/text/projects/frc";
import { cn } from "@/lib/utils";

const small = (id: string) => `/assets/frc/${id}-640.webp`;
const srcSet = (p: FrcPhoto) => `${small(p.id)} 640w, /assets/frc/${p.id}.webp ${p.w}w`;

/* ------------------------------------------------------------------ */
/* The season story                                                    */
/* ------------------------------------------------------------------ */

// The map: equirectangular, centred on the Pacific (150°E) so the flight to Vancouver doesn't wrap round the edge.
const W = 1000;
const H = 440;
const at = (lat: number, lon: number) => ({ x: ((((lon - 150 + 180) % 360) + 360) % 360) * (W / 360), y: ((90 - lat) * H) / 180 + 40 });
const CITY = [at(10.82, 106.63), at(49.28, -123.12), at(41.01, 28.98), at(21.31, -157.86)];
/** An arc from home to a city, bowed toward the pole like a flight path. */
const arc = (to: { x: number; y: number }) => {
	const a = CITY[0];
	const mx = (a.x + to.x) / 2;
	const my = Math.min(a.y, to.y) - Math.abs(to.x - a.x) * 0.28;
	return `M${a.x},${a.y} Q${mx},${my} ${to.x},${to.y}`;
};

export function SeasonStory() {
	const t = seasonStory;
	const [active, setActive] = useState(0);
	const cards = useRef<(HTMLElement | null)[]>([]);
	useEffect(() => {
		// The scene whose text crosses the middle of the screen is the one on the stage.
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.k));
			},
			// Phones: the stage covers the top half, so the line is lower down.
			{ rootMargin: matchMedia("(min-width: 768px)").matches ? "-45% 0px -45% 0px" : "-72% 0px -22% 0px" },
		);
		cards.current.forEach((el) => el && io.observe(el));
		return () => io.disconnect();
	}, []);
	const scene = t.scenes[active];
	return (
		<MotionConfig reducedMotion="user">
			{/* Phones: plain flow, the stage sticks on top while the text scrolls under it. Wider: text left, stage right. */}
			<div className="md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-x-12">
				<div className="sticky top-[4.5rem] z-10 -mx-4 h-[40svh] bg-background px-4 pb-3 pt-2 md:order-2 md:mx-0 md:h-[calc(100svh-6.5rem)] md:self-start md:bg-transparent md:px-0 md:py-6">
					<Stage active={active} />
				</div>
				<ol className="relative md:order-1">
					{t.scenes.map((s, k) => (
						<li
							key={s.when + k}
							ref={(el) => {
								cards.current[k] = el;
							}}
							data-k={k}
							className="flex min-h-[70svh] items-center py-10 md:min-h-[88svh]"
						>
							<div className={cn("flex flex-col gap-3 rounded-2xl border bg-card/85 p-6 backdrop-blur-sm transition-opacity duration-500 md:p-8", active === k ? "opacity-100" : "md:opacity-35")}>
								<p className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
									<span className="tabular-nums">
										{String(k + 1).padStart(2, "0")} / {String(t.scenes.length).padStart(2, "0")}
									</span>
									<span aria-hidden="true" className="h-px w-8 bg-foreground/30" />
									{s.when}
								</p>
								<h3 className="font-wide text-[clamp(1.75rem,3.4vw,2.75rem)] font-[880] leading-[1.02]">{s.title}</h3>
								<p className="text-lg text-muted-foreground">{s.text}</p>
								<p className="mt-2 flex items-baseline gap-3 md:hidden">
									<span className="font-wide text-3xl font-[900] tabular-nums">{s.big}</span>
									<span className="text-sm text-muted-foreground">{s.small}</span>
								</p>
							</div>
						</li>
					))}
				</ol>
			</div>
			<p className="sr-only" aria-live="polite">
				{scene.when}: {scene.title}
			</p>
		</MotionConfig>
	);
}

function Stage({ active }: { active: number }) {
	const t = seasonStory;
	const scene = t.scenes[active];
	const photo = frcPhotos[scene.photo] as FrcPhoto;
	const reduce = useReducedMotion();
	return (
		<div className="relative size-full overflow-hidden rounded-2xl border bg-[#070b12] shadow-xl">
			<AnimatePresence initial={false}>
				<motion.img
					key={photo.id}
					src={small(photo.id)}
					srcSet={srcSet(photo)}
					sizes="(min-width: 768px) 55vw, 100vw"
					alt={photo.alt}
					className="absolute inset-0 size-full object-cover"
					initial={{ opacity: 0, scale: 1.12 }}
					animate={{ opacity: 1, scale: 1.02, transition: { opacity: { duration: 0.7 }, scale: { duration: 7, ease: "easeOut" } } }}
					exit={{ opacity: 0, transition: { duration: 0.7 } }}
				/>
			</AnimatePresence>
			<div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
			{/* Progress: one tick per scene. */}
			<div aria-hidden="true" className="absolute inset-x-5 top-5 flex gap-1.5">
				{t.scenes.map((_, k) => (
					<span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
						<motion.span className="block h-full rounded-full bg-white" initial={false} animate={{ width: k <= active ? "100%" : "0%" }} transition={{ duration: reduce ? 0 : 0.5 }} />
					</span>
				))}
			</div>
			{/* The map in the top corner; the big figure along the bottom (on phones the figure sits under the text instead). */}
			<div className="absolute right-3 top-8 w-[9.5rem] md:right-6 md:top-11 md:w-[16rem]">
				<RouteMap route={scene.route} />
			</div>
			<div className="absolute inset-x-6 bottom-6 hidden flex-col text-white md:flex md:inset-x-8 md:bottom-8">
				<BigFigure value={scene.big} />
				<span className="text-base text-white/85">{scene.small}</span>
			</div>
		</div>
	);
}

/** The big figure: a number counts up to its value (once per scene); anything else just appears. */
function BigFigure({ value }: { value: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	const reduce = useReducedMotion();
	useEffect(() => {
		const el = ref.current;
		const m = value.match(/^([\d,]+)(.*)$/);
		if (!el || !m || reduce) return;
		const to = Number(m[1].replace(/,/g, ""));
		const ctl = animate(0, to, { duration: 1, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => (el.textContent = Math.round(v).toLocaleString("en-US") + m[2]) });
		return () => ctl.stop();
	}, [value, reduce]);
	return (
		<span ref={ref} className="whitespace-nowrap font-wide text-[clamp(2.75rem,6vw,5.5rem)] font-[900] leading-none tabular-nums">
			{value}
		</span>
	);
}

function RouteMap({ route }: { route: number }) {
	const t = seasonStory;
	const dots = [];
	for (let x = 10; x < W; x += 26) for (let y = 30; y < H + 40; y += 26) dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />);
	return (
		<figure className="m-0 w-full rounded-xl border border-white/15 bg-black/55 p-1.5 backdrop-blur-sm md:p-2">
			<svg viewBox={`0 0 ${W} ${H + 60}`} className="block h-auto w-full" role="img" aria-label={t.mapLabel}>
				<g fill="rgb(255 255 255 / 0.14)">{dots}</g>
				{[1, 2, 3].map((c) => (
					<motion.path
						key={c}
						d={arc(CITY[c])}
						fill="none"
						stroke={c === 3 ? "#f4b62a" : "#5ce1ff"}
						strokeWidth={5}
						strokeLinecap="round"
						strokeDasharray={c === 3 ? "2 14" : undefined}
						initial={false}
						animate={{ pathLength: route >= c ? 1 : 0, opacity: route >= c ? 1 : 0 }}
						transition={{ duration: 1.1, ease: "easeInOut" }}
					/>
				))}
				{CITY.map((p, c) => (
					<g key={c} opacity={c === 0 || route >= c ? 1 : 0.35}>
						<circle cx={p.x} cy={p.y} r={c === Math.max(route, 0) ? 13 : 8} fill={c === 0 ? "#ffffff" : c === 3 ? "#f4b62a" : "#5ce1ff"} />
						<text x={p.x} y={p.y - 22} textAnchor="middle" fill="#fff" fontSize="42" fontWeight="600" fontFamily="ui-sans-serif, system-ui">
							{t.cities[c]}
						</text>
					</g>
				))}
			</svg>
		</figure>
	);
}

/* ------------------------------------------------------------------ */
/* The swerve lab                                                      */
/* ------------------------------------------------------------------ */

type Part = "module" | "battery" | "controller";

export function SwerveLab() {
	const t = swerveSim;
	const photo = frcPhotos[t.photo] as FrcPhoto;
	const [lit, setLit] = useState<{ part: Part; m?: number } | null>(null);
	return (
		<div className="grid gap-8 lg:grid-cols-2">
			<SwerveCanvas lit={lit?.part === "module" ? lit.m : undefined} />
			<figure className="m-0 flex flex-col gap-3">
				<div className="relative overflow-hidden rounded-2xl border">
					<img src={small(photo.id)} srcSet={srcSet(photo)} sizes="(min-width: 1024px) 45vw, 100vw" alt={photo.alt} width={photo.w} height={photo.h} loading="lazy" className="h-auto w-full" />
					{t.hotspots.map((h, i) => {
						const part: Part = h.k ?? "module";
						const on = lit && lit.part === part && lit.m === h.m;
						return (
							<button
								key={i}
								type="button"
								className={cn("frc-hotspot", h.k && "frc-hotspot-alt", on && "is-on")}
								style={{ left: `${h.left}%`, top: `${h.top}%` }}
								aria-label={h.m !== undefined ? `${t.moduleNames[h.m]} ${t.parts.module.name.toLowerCase()}` : t.parts[part].name}
								aria-pressed={!!on}
								onMouseEnter={() => setLit({ part, m: h.m })}
								onFocus={() => setLit({ part, m: h.m })}
								onClick={() => setLit(on ? null : { part, m: h.m })}
							>
								<i aria-hidden="true" />
							</button>
						);
					})}
				</div>
				<figcaption className="min-h-[5.5rem] rounded-xl border bg-card p-4" aria-live="polite">
					{lit ? (
						<>
							<p className="font-semibold">
								{lit.m !== undefined ? `${t.moduleNames[lit.m]} · ` : ""}
								{t.parts[lit.part].name}
							</p>
							<p className="text-sm text-muted-foreground">{t.parts[lit.part].text}</p>
						</>
					) : (
						<>
							<p className="font-semibold">{t.photoHeading}</p>
							<p className="text-sm text-muted-foreground">{t.photoHint}</p>
						</>
					)}
				</figcaption>
			</figure>
		</div>
	);
}

// Field and robot, in metres. The robot is 0.8 m square; its modules sit 0.3 m from the centre on each axis.
const FIELD = { w: 6, h: 4.05 };
const HALF = 0.4;
const MOD = [
	[0.3, -0.3],
	[0.3, 0.3],
	[-0.3, -0.3],
	[-0.3, 0.3],
] as const; // FL, FR, BL, BR in the robot's frame (x forward, y right)
const VMAX = 2.6; // m/s
const WMAX = 3.2; // rad/s
const ACCEL = 6; // m/s² (how fast the robot answers)

function SwerveCanvas({ lit }: { lit?: number }) {
	const t = swerveSim;
	const canvas = useRef<HTMLCanvasElement>(null);
	const [readout, setReadout] = useState(() => MOD.map(() => ({ a: 0, s: 0 })));
	const [auto, setAuto] = useState(true);
	const [spin, setSpin] = useState(false);
	const litRef = useRef(lit);
	litRef.current = lit;
	const ctl = useRef({ auto: true, spin: false, keys: new Set<string>(), aim: null as null | { x: number; y: number }, turn: 0 });
	ctl.current.auto = auto;
	ctl.current.spin = spin;

	useEffect(() => {
		const el = canvas.current;
		if (!el) return;
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion");
		if (reduce) setAuto(false);
		const g = el.getContext("2d")!;
		const robot = { x: FIELD.w / 2, y: FIELD.h / 2, th: 0, vx: 0, vy: 0, w: 0 };
		const mods = MOD.map(() => ({ a: 0, s: 0 }));
		const trail: { x: number; y: number }[] = [];
		let raf = 0;
		let visible = false;
		let last = performance.now();
		let clock = 0;
		let shown = 0;
		const size = () => {
			const dpr = Math.min(devicePixelRatio || 1, 2);
			el.width = Math.round(el.clientWidth * dpr);
			el.height = Math.round(el.clientHeight * dpr);
		};
		size();
		const ro = new ResizeObserver(size);
		ro.observe(el);

		const frame = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			clock += dt;
			const c = ctl.current;
			// What the driver (or the auto routine) asks for, in field coordinates.
			let wantX = 0;
			let wantY = 0;
			let wantW = c.turn * WMAX;
			const k = c.keys;
			if (k.size) {
				wantX = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
				wantY = (k.has("s") ? 1 : 0) - (k.has("w") ? 1 : 0);
				const n = Math.hypot(wantX, wantY) || 1;
				wantX = (wantX / n) * VMAX;
				wantY = (wantY / n) * VMAX;
				wantW += ((k.has("e") ? 1 : 0) - (k.has("q") ? 1 : 0)) * WMAX;
			} else if (c.aim) {
				const dx = c.aim.x - robot.x;
				const dy = c.aim.y - robot.y;
				const d = Math.hypot(dx, dy);
				const v = Math.min(VMAX, d * 2.2);
				if (d > 0.05) {
					wantX = (dx / d) * v;
					wantY = (dy / d) * v;
				}
			} else if (c.auto) {
				// A slow figure of eight while it turns to face along its path.
				const ax = FIELD.w / 2 + Math.sin(clock * 0.5) * 1.9;
				const ay = FIELD.h / 2 + Math.sin(clock * 1) * 0.95;
				wantX = (ax - robot.x) * 1.6;
				wantY = (ay - robot.y) * 1.6;
				wantW = Math.sin(clock * 0.35) * 1.6;
			}
			if (c.spin) wantW = WMAX * 0.8;
			// Answer at a limited acceleration, like a real drivebase.
			const step = ACCEL * dt;
			const ease = (v: number, to: number) => v + Math.max(-step, Math.min(step, to - v));
			robot.vx = ease(robot.vx, wantX);
			robot.vy = ease(robot.vy, wantY);
			robot.w = robot.w + Math.max(-step * 2, Math.min(step * 2, wantW - robot.w));
			robot.x = Math.max(HALF, Math.min(FIELD.w - HALF, robot.x + robot.vx * dt));
			robot.y = Math.max(HALF, Math.min(FIELD.h - HALF, robot.y + robot.vy * dt));
			robot.th += robot.w * dt;
			// Swerve kinematics: each module's velocity is the robot's, plus the turn (ω × r), in the robot's frame.
			const cos = Math.cos(robot.th);
			const sin = Math.sin(robot.th);
			const rx = robot.vx * cos + robot.vy * sin;
			const ry = -robot.vx * sin + robot.vy * cos;
			MOD.forEach(([mx, my], i) => {
				const vx = rx - robot.w * my;
				const vy = ry + robot.w * mx;
				const s = Math.hypot(vx, vy);
				if (s > 0.02) {
					let a = Math.atan2(vy, vx);
					let speed = s;
					// A module never turns more than 90°: past that it points the other way and runs backwards.
					let diff = Math.atan2(Math.sin(a - mods[i].a), Math.cos(a - mods[i].a));
					if (Math.abs(diff) > Math.PI / 2) {
						a += Math.PI;
						speed = -s;
						diff = Math.atan2(Math.sin(a - mods[i].a), Math.cos(a - mods[i].a));
					}
					mods[i].a += diff * Math.min(1, dt * 18);
					mods[i].s = speed;
				} else mods[i].s *= 0.8;
			});
			if (Math.hypot(robot.vx, robot.vy) > 0.05) {
				trail.push({ x: robot.x, y: robot.y });
				if (trail.length > 90) trail.shift();
			} else if (trail.length) trail.shift();
			draw(g, el, robot, mods, trail, litRef.current);
			if (now - shown > 120) {
				shown = now;
				setReadout(mods.map((m) => ({ a: Math.round((((m.a * 180) / Math.PI) % 360 + 360) % 360), s: Math.abs(m.s) })));
			}
			raf = visible ? requestAnimationFrame(frame) : 0;
		};
		const run = () => {
			if (!raf && visible) {
				last = performance.now();
				raf = requestAnimationFrame(frame);
			}
		};
		// Draws only while it is on screen and the tab is in front.
		const io = new IntersectionObserver(([e]) => {
			visible = e.isIntersecting && !document.hidden;
			run();
		});
		io.observe(el);
		const onVis = () => {
			visible = !document.hidden && visible;
			run();
		};
		document.addEventListener("visibilitychange", onVis);
		draw(g, el, robot, mods, trail, undefined);

		const toField = (e: PointerEvent) => {
			const r = el.getBoundingClientRect();
			return { x: ((e.clientX - r.left) / r.width) * FIELD.w, y: ((e.clientY - r.top) / r.height) * FIELD.h };
		};
		const move = (e: PointerEvent) => {
			if (e.pointerType === "mouse" || e.buttons) {
				ctl.current.aim = toField(e);
				setAuto(false);
			}
		};
		const leave = () => (ctl.current.aim = null);
		const down = (e: PointerEvent) => {
			ctl.current.aim = toField(e);
			setAuto(false);
			el.setPointerCapture(e.pointerId);
		};
		const keys = (e: KeyboardEvent, on: boolean) => {
			const key = e.key.toLowerCase();
			if (!"wasdqe".includes(key) || key.length !== 1) return;
			e.preventDefault();
			if (on) {
				ctl.current.keys.add(key);
				setAuto(false);
			} else ctl.current.keys.delete(key);
		};
		const kd = (e: KeyboardEvent) => keys(e, true);
		const ku = (e: KeyboardEvent) => keys(e, false);
		el.addEventListener("pointermove", move);
		el.addEventListener("pointerdown", down);
		el.addEventListener("pointerleave", leave);
		el.addEventListener("pointerup", (e) => e.pointerType !== "mouse" && leave());
		el.addEventListener("keydown", kd);
		el.addEventListener("keyup", ku);
		el.addEventListener("blur", () => ctl.current.keys.clear());
		return () => {
			cancelAnimationFrame(raf);
			io.disconnect();
			ro.disconnect();
			document.removeEventListener("visibilitychange", onVis);
		};
	}, []);

	const hold = (dir: -1 | 1) => ({
		onPointerDown: () => {
			ctl.current.turn = dir;
			setAuto(false);
		},
		onPointerUp: () => (ctl.current.turn = 0),
		onPointerLeave: () => (ctl.current.turn = 0),
		onKeyDown: (e: React.KeyboardEvent) => (e.key === " " || e.key === "Enter") && (ctl.current.turn = dir),
		onKeyUp: () => (ctl.current.turn = 0),
	});

	return (
		<div className="flex flex-col gap-3">
			<div className="overflow-hidden rounded-2xl border bg-[#0a101b] text-white">
				<div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-white/70">
					<span>{t.title}</span>
					<button type="button" onClick={() => setAuto((a) => !a)} aria-pressed={auto} className={cn("rounded-full border px-2.5 py-1", auto ? "border-[#5ce1ff] text-[#5ce1ff]" : "border-white/25")}>
						{t.auto}
					</button>
				</div>
				<canvas ref={canvas} tabIndex={0} aria-label={`${t.canvasLabel}. ${t.howTo}`} className="block aspect-[40/27] w-full cursor-crosshair touch-none outline-offset-[-3px]" />
				<dl className="grid grid-cols-4 border-t border-white/10 font-mono text-xs">
					{readout.map((r, i) => (
						<div key={i} className={cn("flex flex-col gap-0.5 px-3 py-2.5", i && "border-l border-white/10", lit === i && "bg-[#5ce1ff]/15")}>
							<dt className="text-white/60">{t.modules[i]}</dt>
							<dd className="tabular-nums">
								{String(r.a).padStart(3, "0")}° · {r.s.toFixed(1)} m/s
							</dd>
						</div>
					))}
				</dl>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" className="frc-chip-btn" aria-label={t.rotateLeft} {...hold(-1)}>
					<RotateCcw className="size-4" aria-hidden="true" />
				</button>
				<button type="button" className="frc-chip-btn" aria-label={t.rotateRight} {...hold(1)}>
					<RotateCw className="size-4" aria-hidden="true" />
				</button>
				<button type="button" className={cn("frc-chip-btn px-3", spin && "is-on")} aria-pressed={spin} onClick={() => setSpin((s) => !s)}>
					{t.spin}
				</button>
				<p className="ml-auto text-sm text-muted-foreground">{t.howTo}</p>
			</div>
		</div>
	);
}

function draw(
	g: CanvasRenderingContext2D,
	el: HTMLCanvasElement,
	robot: { x: number; y: number; th: number },
	mods: { a: number; s: number }[],
	trail: { x: number; y: number }[],
	lit: number | undefined,
) {
	const s = el.width / FIELD.w; // px per metre
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.fillStyle = "#0a101b";
	g.fillRect(0, 0, el.width, el.height);
	// The carpet: a metre grid, and the centre line.
	g.strokeStyle = "rgba(120,165,230,0.10)";
	g.lineWidth = 1;
	for (let x = 1; x < FIELD.w; x++) line(g, x * s, 0, x * s, el.height);
	for (let y = 1; y < FIELD.h; y++) line(g, 0, y * s, el.width, y * s);
	g.strokeStyle = "rgba(120,165,230,0.28)";
	line(g, (FIELD.w / 2) * s, 0, (FIELD.w / 2) * s, el.height);
	// Where it has been.
	trail.forEach((p, i) => {
		g.fillStyle = `rgba(92,225,255,${(i / trail.length) * 0.35})`;
		g.beginPath();
		g.arc(p.x * s, p.y * s, 0.04 * s, 0, Math.PI * 2);
		g.fill();
	});
	g.translate(robot.x * s, robot.y * s);
	g.rotate(robot.th);
	// Bumpers and frame.
	const b = HALF * s;
	g.fillStyle = "#1f4fd1";
	roundRect(g, -b, -b, b * 2, b * 2, 0.08 * s);
	g.fill();
	g.fillStyle = "#121a2a";
	roundRect(g, -b * 0.8, -b * 0.8, b * 1.6, b * 1.6, 0.04 * s);
	g.fill();
	g.fillStyle = "#ffffff";
	g.font = `700 ${Math.round(0.11 * s)}px ui-monospace, monospace`;
	g.textAlign = "center";
	g.textBaseline = "middle";
	g.save();
	g.translate(-b * 0.9, 0);
	g.rotate(-Math.PI / 2);
	g.fillText("10951", 0, 0);
	g.restore();
	// The front, so you can see which way it faces.
	g.fillStyle = "#f4b62a";
	g.beginPath();
	g.moveTo(b * 0.78, 0);
	g.lineTo(b * 0.55, -0.1 * s);
	g.lineTo(b * 0.55, 0.1 * s);
	g.closePath();
	g.fill();
	// The four modules: the wheel at its steering angle, and a line as long as its speed.
	MOD.forEach(([mx, my], i) => {
		const m = mods[i];
		g.save();
		g.translate(mx * s, my * s);
		if (lit === i) {
			g.fillStyle = "rgba(92,225,255,0.25)";
			g.beginPath();
			g.arc(0, 0, 0.17 * s, 0, Math.PI * 2);
			g.fill();
		}
		g.rotate(m.a);
		g.fillStyle = lit === i ? "#5ce1ff" : "#d6dde8";
		roundRect(g, -0.07 * s, -0.035 * s, 0.14 * s, 0.07 * s, 0.02 * s);
		g.fill();
		const len = (m.s / VMAX) * 0.3 * s;
		g.strokeStyle = "#5ce1ff";
		g.lineWidth = Math.max(2, 0.018 * s);
		line(g, 0, 0, len, 0);
		g.restore();
	});
}

function line(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
	g.beginPath();
	g.moveTo(x1, y1);
	g.lineTo(x2, y2);
	g.stroke();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	g.beginPath();
	g.roundRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------ */
/* The sub-teams                                                       */
/* ------------------------------------------------------------------ */

export function SubTeamPicker() {
	const t = teamMore;
	const [on, setOn] = useState(0);
	const team = t.subTeams[on];
	return (
		<MotionConfig reducedMotion="user">
			<div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<div className="flex flex-col gap-3">
					<p className="text-sm text-muted-foreground">{t.pickHint}</p>
					<ul className="flex flex-col gap-1.5">
						{t.subTeams.map((s, i) => (
							<li key={s.name}>
								<button
									type="button"
									aria-pressed={on === i}
									onMouseEnter={() => setOn(i)}
									onFocus={() => setOn(i)}
									onClick={() => setOn(i)}
									className={cn("frc-pick group flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left", on === i && "is-on")}
								>
									<span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
									<span className="font-semiwide text-lg font-[760]">{s.name}</span>
									<span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{t.tracks[s.track as keyof typeof t.tracks]}</span>
								</button>
							</li>
						))}
					</ul>
				</div>
				<div className="relative min-h-[22rem] overflow-hidden rounded-2xl border surface p-6 md:p-8" aria-live="polite">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div key={team.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }} className="flex flex-col gap-4">
							<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
								{String(on + 1).padStart(2, "0")} · {t.tracks[team.track as keyof typeof t.tracks]}
							</p>
							<h4 className="font-wide text-[clamp(1.75rem,3vw,2.5rem)] font-[880] leading-tight">{team.name}</h4>
							<p className="text-lg text-muted-foreground">{team.role}</p>
							<h5 className="mt-2 text-sm font-semibold">{t.jobsHeading}</h5>
							<ul className="flex flex-col gap-2">
								{team.jobs.map((j, k) => (
									<motion.li key={j} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * k + 0.1 }} className="flex gap-3">
										<span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-background">
											<Check className="size-3" aria-hidden="true" strokeWidth={3} />
										</span>
										{j}
									</motion.li>
								))}
							</ul>
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	);
}

/* ------------------------------------------------------------------ */
/* The certification path and the checklist                            */
/* ------------------------------------------------------------------ */

export function CertPipeline() {
	const t = workshop;
	const [step, setStep] = useState(0);
	const [ticked, setTicked] = useState<boolean[]>(() => t.checklist.map(() => false));
	const n = t.steps.length;
	const go = (i: number) => setStep(Math.max(0, Math.min(n - 1, i)));
	const done = ticked.filter(Boolean).length;
	return (
		<MotionConfig reducedMotion="user">
			<div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
				<div
					className="flex flex-col gap-6 rounded-2xl border surface p-6 md:p-8"
					onKeyDown={(e) => {
						if (e.key === "ArrowRight") go(step + 1);
						if (e.key === "ArrowLeft") go(step - 1);
					}}
				>
					<h3 className="font-semiwide text-xl font-[780]">{t.stepsHeading}</h3>
					<ol className="relative flex justify-between" aria-label={t.stepsHeading}>
						<span aria-hidden="true" className="absolute inset-x-4 top-4 h-0.5 bg-foreground/15" />
						<motion.span aria-hidden="true" className="absolute left-4 top-4 h-0.5 bg-foreground" initial={false} animate={{ width: `calc(${(step / (n - 1)) * 100}% - ${(step / (n - 1)) * 2}rem)` }} transition={{ type: "spring", bounce: 0, duration: 0.5 }} />
						{t.steps.map((s, i) => (
							<li key={s.title} className="relative">
								<button
									type="button"
									onMouseEnter={() => go(i)}
									onClick={() => go(i)}
									aria-current={step === i ? "step" : undefined}
									aria-label={`${t.stepOf} ${i + 1}: ${s.title}`}
									className={cn("grid size-9 place-items-center rounded-full border-2 font-mono text-sm font-bold transition-colors", i <= step ? "border-foreground bg-foreground text-background" : "border-foreground/30 bg-card", i === n - 1 && i <= step && "border-accent bg-accent text-accent-foreground")}
								>
									{i + 1}
								</button>
							</li>
						))}
					</ol>
					<div className="min-h-[7.5rem]" aria-live="polite">
						<AnimatePresence mode="wait" initial={false}>
							<motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }} className="flex flex-col gap-2">
								<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
									{t.stepOf} {step + 1} / {n}
								</p>
								<h4 className="font-wide text-2xl font-[850]">{t.steps[step].title}</h4>
								<p className="text-muted-foreground">{t.steps[step].text}</p>
							</motion.div>
						</AnimatePresence>
					</div>
					<div className="flex gap-2">
						<button type="button" className="frc-chip-btn" onClick={() => go(step - 1)} disabled={step === 0} aria-label={t.prev}>
							<ArrowLeft className="size-4" aria-hidden="true" />
						</button>
						<button type="button" className="frc-chip-btn" onClick={() => go(step + 1)} disabled={step === n - 1} aria-label={t.next}>
							<ArrowRight className="size-4" aria-hidden="true" />
						</button>
					</div>
				</div>
				<div className="flex flex-col gap-4">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="font-semiwide text-xl font-[780]">{t.checklistHeading}</h3>
						<p className="font-mono text-sm tabular-nums" aria-live="polite">
							{done} / {ticked.length} {t.checklistTicked}
						</p>
					</div>
					<ul className="flex flex-col">
						{t.checklist.map((c, i) => (
							<li key={c} className="border-t">
								<label className="flex min-h-12 cursor-pointer items-center gap-3 py-2.5">
									<input type="checkbox" className="peer sr-only" checked={ticked[i]} onChange={() => setTicked((v) => v.map((x, k) => (k === i ? !x : x)))} />
									<motion.span
										aria-hidden="true"
										className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2", ticked[i] ? "border-[#15803d] bg-[#15803d] text-white dark:border-[#4ade80] dark:bg-[#4ade80] dark:text-black" : "border-foreground/35")}
										animate={{ scale: ticked[i] ? [1, 1.25, 1] : 1 }}
										transition={{ duration: 0.3 }}
									>
										{ticked[i] && <Check className="size-4" strokeWidth={3} />}
									</motion.span>
									<span className={cn("transition-colors", ticked[i] && "text-muted-foreground line-through decoration-foreground/40")}>{c}</span>
								</label>
							</li>
						))}
					</ul>
					<AnimatePresence>
						{done === ticked.length && (
							<motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="font-wide text-xl font-[850] text-[#15803d] dark:text-[#4ade80]">
								{t.checklistDone}
							</motion.p>
						)}
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	);
}

/* ------------------------------------------------------------------ */
/* Kinds of support                                                    */
/* ------------------------------------------------------------------ */

export function SupportPicker() {
	const t = partner;
	const [on, setOn] = useState(0);
	const kind = t.kinds[on];
	return (
		<MotionConfig reducedMotion="user">
			<div className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
				<div className="flex flex-col gap-3">
					<p className="text-sm font-semibold">{t.pickLabel}</p>
					<ul className="flex flex-col gap-1.5">
						{t.kinds.map((k, i) => (
							<li key={k.name}>
								<button type="button" aria-pressed={on === i} onMouseEnter={() => setOn(i)} onFocus={() => setOn(i)} onClick={() => setOn(i)} className={cn("frc-pick flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold", on === i && "is-on")}>
									{k.name}
									<ArrowRight className="size-4 opacity-60" aria-hidden="true" />
								</button>
							</li>
						))}
					</ul>
				</div>
				<div className="relative overflow-hidden rounded-2xl border surface p-6 md:p-8" aria-live="polite">
					<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t.powersLabel}</p>
					<AnimatePresence mode="wait" initial={false}>
						<motion.div key={kind.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mt-3 flex flex-col gap-4">
							<h4 className="font-wide text-[clamp(1.6rem,3vw,2.25rem)] font-[880] leading-tight">{kind.name}</h4>
							<ul className="flex flex-col gap-2.5">
								{kind.items.map((item, k) => (
									<motion.li key={item} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * k + 0.08 }} className="flex gap-3 text-lg">
										<span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-accent ring-1 ring-foreground/30" />
										{item}
									</motion.li>
								))}
							</ul>
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	);
}
