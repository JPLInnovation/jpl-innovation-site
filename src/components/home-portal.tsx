import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import GlyphPortal from "@/components/ui/glyph-portal";
import { Button } from "@/components/ui/button";
import { services } from "@/data/services";

const FACE = '"Archivo Variable", sans-serif';
const FALLBACK = '"Arial Black", Arial, sans-serif';
const WORD = "JPL";

const kicker = "Student-founded engineering startup · Ho Chi Minh City";
const support = "We design, build and secure real technology: robots, drones, networks and the web.";

/**
 * Home page hero. The camera flies through the letters J-P-L into a photo of a build
 * (FRC Team 10951's 2026 robot, one of the projects we work on), then the intro fades in over it.
 */
export default function HomePortal() {
	const [face, setFace] = useState<string | null>(null);

	useEffect(() => {
		// GlyphPortal measures the font once when it mounts, so wait for Archivo first.
		let settled = false;
		const finish = (value: string) => {
			if (!settled) {
				settled = true;
				setFace(value);
			}
		};
		const timeout = window.setTimeout(() => finish(FALLBACK), 1600);
		document.fonts.load(`900 100px "Archivo Variable"`, WORD).then(
			(faces) => finish(faces.length ? FACE : FALLBACK),
			() => finish(FALLBACK),
		);
		return () => {
			settled = true;
			clearTimeout(timeout);
		};
	}, []);

	if (!face) return <Poster />;

	return (
		<div data-jpl-portal>
			<style>{portalCss}</style>
			<GlyphPortal
				word={WORD}
				fontFamily={face}
				fontWeight={900}
				scrollLength={2.6}
				enterLabel="See what we build"
				style={{
					"--gp-paper": "var(--background)",
					"--gp-ink": "var(--foreground)",
					"--gp-field": "var(--hero-field)",
					"--gp-foreground": "#ffffff",
					fontFamily: "inherit",
				}}
				background={<BuildPhoto />}
				front={
					<>
						<p data-jpl-kicker>{kicker}</p>
						<p data-jpl-support>{support}</p>
						<span data-jpl-scroll>
							Scroll to fly in <ArrowDown className="size-4" aria-hidden="true" />
						</span>
					</>
				}
			>
				<Intro />
			</GlyphPortal>
		</div>
	);
}

function BuildPhoto() {
	return (
		<div className="absolute inset-0" style={{ transform: "scale(var(--gp-field-scale,1))" }}>
			<img
				src="/assets/FRCnew.jpg"
				alt=""
				className="absolute inset-0 size-full object-cover object-[32%_68%]"
				fetchPriority="high"
			/>
			{/* Darkens only once the camera is through. The copy sits on the left, so the scrim is strongest there
			    (keeps the white text above WCAG AA even over the bright parts of the photo). */}
			<div className="absolute inset-0" style={{ opacity: "var(--gp-reveal,0)" }}>
				<div className="absolute inset-0 bg-gradient-to-t from-hero-field via-hero-field/70 to-hero-field/25" />
				<div className="absolute inset-0 bg-gradient-to-r from-hero-field/90 via-hero-field/60 to-transparent" />
			</div>
		</div>
	);
}

/** What JPL Innovation is, over the photo. Service names come from src/data/services.ts (placeholders, TODO: confirm). */
function Intro() {
	return (
		<div className="wrapper flex flex-col gap-10 !px-0">
			<div className="flex max-w-3xl flex-col gap-5">
				<h2 className="font-wide text-[clamp(2rem,4.6vw,3.75rem)] font-[820] leading-[1.02]">
					Ideas in, working technology out.
				</h2>
				<p className="max-w-[58ch] text-lg text-white/85">
					JPL Innovation is a small team of student engineers. We take projects from the first sketch to a tested,
					working build (machines, networks and software) and document what we learn along the way.
				</p>
			</div>
			<ul className="grid max-w-3xl gap-x-8 gap-y-3 border-t border-white/20 pt-6 sm:grid-cols-2">
				{services.map((s) => (
					<li key={s.title} className="flex items-center gap-3 text-white/90">
						<span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
						{s.title}
					</li>
				))}
			</ul>
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap gap-3">
					<Button asChild variant="signal" size="lg">
						<a href="/#services">
							Our services <ArrowRight aria-hidden="true" />
						</a>
					</Button>
					<Button
						asChild
						variant="outline"
						size="lg"
						className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent"
					>
						<a href="/work/">See our work</a>
					</Button>
				</div>
				<p className="text-sm text-white/70">Pictured: FRC Team 10951&rsquo;s 2026 robot, one of the projects we work on.</p>
			</div>
		</div>
	);
}

/** Server-rendered and no-JS version: the same opening frame, without the camera. */
function Poster() {
	return (
		<section className="relative flex min-h-[100svh] flex-col items-center justify-center gap-6 px-4 text-center">
			<p className="text-[15px] text-muted-foreground">{kicker}</p>
			<p
				className="font-black leading-none tracking-tight"
				style={{ fontSize: "min(38svh, 60vw)" }}
				aria-hidden="true"
			>
				{WORD}
			</p>
			<p className="max-w-[40ch] text-lg">{support}</p>
			<Button asChild variant="signal" size="lg">
				<a href="/#services">Our services</a>
			</Button>
		</section>
	);
}

const portalCss = `
[data-jpl-portal] [data-gp-caption]{inset:calc(var(--gp-word-bottom,50%) + 6.5rem) 1rem auto;justify-content:center;}
[data-jpl-portal] [data-gp-hint]{display:none;}
[data-jpl-portal] [data-gp-enter]{min-height:48px;padding:0 1.25rem;gap:.75rem;border-radius:var(--radius);background:var(--accent);color:var(--accent-foreground);font-size:15px;font-weight:650;transition:background-color .18s;}
[data-jpl-portal] [data-gp-enter]:hover{background:color-mix(in srgb,var(--accent) 85%,var(--foreground));}
[data-jpl-portal] [data-gp-enter]:focus-visible{outline:2px solid var(--ring);outline-offset:3px;background:var(--accent);color:var(--accent-foreground);padding:0 1.25rem;margin:0;}
[data-jpl-portal] [data-gp-touch-picker]{top:auto;bottom:1rem;}
[data-jpl-portal] [data-gp-select]{border-color:var(--border);border-radius:var(--radius);font-size:13px;}
[data-jpl-portal] [data-gp-content]{padding:6rem clamp(1rem,4vw,2.5rem);font-family:inherit;}
[data-jpl-kicker]{position:absolute;inset:auto 1rem calc(100% - var(--gp-word-top,35%) + 1.5rem);margin:0;text-align:center;font-size:15px;color:var(--muted-foreground);}
[data-jpl-support]{position:absolute;inset:calc(var(--gp-word-bottom,50%) + 1.5rem) 1rem auto;margin:0 auto;max-width:40ch;text-align:center;font-size:clamp(1rem,.9rem + .4vw,1.2rem);line-height:1.5;}
[data-jpl-scroll]{position:absolute;inset:auto 1rem 1.75rem;display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:13px;color:var(--muted-foreground);}
[data-gp-motion=off] [data-jpl-scroll]{display:none;}
@media(any-pointer:coarse){[data-jpl-scroll]{bottom:5rem;}}
@media(max-height:560px){[data-jpl-support]{top:calc(var(--gp-word-bottom,50%) + .75rem);}[data-jpl-portal] [data-gp-caption]{top:calc(var(--gp-word-bottom,50%) + 4.5rem);}[data-jpl-scroll]{display:none;}}
`;
