import { useRef } from "react";
import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";

const highlights = [
	"Six-wheel traction drivebase",
	"Dual-flywheel shooter, 25°–65° hood",
	"Pneumatic climb",
	"Java, WPILib and OpenCV vision",
];

/**
 * FRC page scroll scene. The robot photo starts as a rounded card, opens to fill the screen as you
 * scroll, then the copy arrives over it one line at a time. Under reduced motion it's a still image.
 */
export default function FrcRobotReveal({ src, alt }: { src: string; alt: string }) {
	const ref = useRef<HTMLElement>(null);
	const reduce = useReducedMotion();
	const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });

	// Function-form transforms keep these in JS. (Motion otherwise hands linear opacity/scale mappings to the
	// browser's native scroll timeline, which mis-maps this offset range and fades the copy back out.)
	const map = (input: [number, number], output: [number, number]) =>
		useTransform(p, (v) => {
			const t = Math.min(1, Math.max(0, (v - input[0]) / (input[1] - input[0])));
			return output[0] + (output[1] - output[0]) * t;
		});

	// 0 → 0.45: the card opens to full-bleed while the photo settles from a slight zoom.
	const insetX = map([0, 0.45], [12, 0]);
	const insetY = map([0, 0.45], [10, 0]);
	const radius = map([0, 0.45], [32, 0]);
	const clipPath = useMotionTemplate`inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`;
	const scale = map([0, 0.5], [1.2, 1]);
	// 0.35 → 0.5: darken for the copy.
	const shade = map([0.35, 0.5], [0, 1]);
	// Then the copy, one line at a time.
	const line = (from: number) => ({ opacity: map([from, from + 0.08], [0, 1]), y: map([from, from + 0.08], [40, 0]) });
	const l1 = line(0.45);
	const l2 = line(0.53);
	const l3 = line(0.61);

	if (reduce) {
		return (
			<section className="relative overflow-hidden" aria-label="Our 2026 robot">
				<img src={src} alt={alt} className="h-[70svh] w-full object-cover object-[55%_75%]" />
				<div className="absolute inset-0 bg-gradient-to-t from-hero-field via-hero-field/70 to-transparent" />
				<Copy />
			</section>
		);
	}

	return (
		<section ref={ref} className="relative h-[300vh]" aria-label="Our 2026 robot">
			<div className="sticky top-0 h-svh overflow-hidden">
				<motion.div className="absolute inset-0 overflow-hidden" style={{ clipPath }}>
					<motion.img
						src={src}
						alt={alt}
						className="size-full object-cover object-[55%_75%]"
						style={{ scale }}
					/>
					<motion.div
						className="absolute inset-0 bg-gradient-to-t from-hero-field via-hero-field/85 to-hero-field/35"
						style={{ opacity: shade }}
					/>
				</motion.div>
				<Copy l1={l1} l2={l2} l3={l3} />
			</div>
		</section>
	);
}

type Line = { opacity: MotionValue<number>; y: MotionValue<number> };

function Copy({ l1, l2, l3 }: { l1?: Line; l2?: Line; l3?: Line }) {
	return (
		<div className="wrapper absolute inset-x-0 bottom-0 flex flex-col gap-6 pb-[clamp(2.5rem,9vh,6rem)] text-white">
			<motion.h2
				style={l1}
				className="max-w-4xl font-wide text-[clamp(2.2rem,6vw,5rem)] font-[900] leading-[0.98] tracking-[-0.02em]"
			>
				Designed, built and programmed by students.
			</motion.h2>
			<motion.p style={l2} className="max-w-[52ch] text-lg text-white/85 md:text-xl">
				Our 2026 rookie robot: 140 lb, 12 ft/s, and tuned until its autonomous routine worked 95% of the time.
			</motion.p>
			<motion.ul style={l3} className="flex flex-wrap gap-2">
				{highlights.map((h) => (
					<li
						key={h}
						className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-medium backdrop-blur-md"
					>
						{h}
					</li>
				))}
			</motion.ul>
		</div>
	);
}
