/**
 * Scroll-triggered motion for React islands; the same effects src/scripts/motion.ts gives static markup.
 * Server HTML is always the finished state. After mounting, each element hides itself (before paint)
 * and animates in the first time it scrolls into view. Nothing happens under reduced motion.
 */
import { createElement, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { animate, inView } from "motion";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const MARGIN = "0px 0px -12% 0px" as const;

/** Hide `el` now, then run `play` once when it's in view. */
function useOnceInView<T extends HTMLElement>(hide: (el: T) => void, play: (el: T) => void) {
	const ref = useRef<T>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || reduced()) return;
		hide(el);
		const stop = inView(el, () => {
			play(el);
			stop();
		}, { margin: MARGIN });
		return stop;
		// Runs once per mount; the callbacks are fixed for an element's lifetime.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return ref;
}

type Tag = "div" | "li" | "ul" | "ol" | "section" | "header" | "p" | "figure" | "blockquote";

/** Rise + fade in. */
export function Reveal({
	as = "div",
	delay = 0,
	className,
	children,
	id,
}: {
	as?: Tag;
	/** Seconds. */
	delay?: number;
	className?: string;
	children: ReactNode;
	id?: string;
}) {
	const ref = useOnceInView<HTMLElement>(
		(el) => (el.style.opacity = "0"),
		(el) => animate(el, { opacity: 1, y: [28, 0] }, { type: "spring", bounce: 0, duration: 0.9, delay }),
	);
	return createElement(as, { ref, className, id }, children);
}

/** A bar that grows from its left edge, e.g. a meter fill or a chart segment. */
export function Grow({
	className,
	style,
	delay = 0,
	duration = 1.1,
	linear = false,
	title,
}: {
	className?: string;
	style?: CSSProperties;
	delay?: number;
	duration?: number;
	/** Constant speed, like a clock, instead of easing out. */
	linear?: boolean;
	title?: string;
}) {
	const ref = useOnceInView<HTMLSpanElement>(
		(el) => {
			el.style.transformOrigin = "left center";
			el.style.transform = "scaleX(0)";
		},
		(el) => animate(el, { scaleX: [0, 1] }, { duration, delay, ease: linear ? "linear" : [0.22, 1, 0.36, 1] }),
	);
	return <span ref={ref} className={className} style={style} title={title} />;
}

/** A number that counts up from zero. Renders the final value on the server. */
export function CountUp({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
	const decimals = (String(value).split(".")[1] ?? "").length;
	const format = (n: number) => `${n.toFixed(decimals)}${suffix}`;
	const ref = useOnceInView<HTMLSpanElement>(
		(el) => (el.textContent = format(0)),
		(el) =>
			animate(0, value, {
				duration: 1.4,
				ease: [0.16, 1, 0.3, 1],
				onUpdate: (n) => (el.textContent = format(n)),
			}),
	);
	// One text node, which the animation owns after mount.
	return (
		<span ref={ref} className={className}>
			{format(value)}
		</span>
	);
}
