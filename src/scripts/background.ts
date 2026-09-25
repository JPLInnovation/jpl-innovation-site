/**
 * Animated site background: faint nodes drifting slowly, joined by lines when they're close (a network).
 * Draws on the persistent <canvas data-site-bg> in BaseLayout; the colour glows are pure CSS (global.css).
 *
 * - Lightweight: one 2D canvas, no libraries. Node count scales with the screen; touch devices get fewer
 *   nodes, a 30 fps cap and a 1× pixel ratio.
 * - Pauses whenever the tab is hidden.
 * - prefers-reduced-motion: draws a single still frame and never animates (and reacts if the setting changes).
 * - Colours come from --bg-dot / --bg-line, so it follows light/dark mode; they're kept faint for WCAG AA.
 */
type Dot = { x: number; y: number; vx: number; vy: number; r: number };

const LINK = 130; // px: nodes closer than this are joined
const SPEED = 0.014; // px per ms at most (~14 px/s)

function start(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	const touch = matchMedia("(pointer: coarse)").matches;

	let width = 0;
	let height = 0;
	let nodes: Dot[] = [];
	let raf = 0;
	let last = 0;
	let colors = readColors();

	function readColors() {
		const style = getComputedStyle(document.documentElement);
		return {
			dot: style.getPropertyValue("--bg-dot").trim() || "rgb(29 78 216 / 0.2)",
			line: style.getPropertyValue("--bg-line").trim() || "rgb(29 78 216 / 0.1)",
		};
	}

	const makeNode = (): Dot => ({
		x: Math.random() * width,
		y: Math.random() * height,
		vx: (Math.random() - 0.5) * 2 * SPEED,
		vy: (Math.random() - 0.5) * 2 * SPEED,
		r: 0.9 + Math.random() * 1.3,
	});

	function resize() {
		const dpr = touch ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
		// Roughly one node per 19,000 px², capped so phones and huge screens both stay cheap.
		const target = Math.min(touch ? 34 : 72, Math.max(16, Math.round((width * height) / 19000)));
		while (nodes.length < target) nodes.push(makeNode());
		nodes.length = target;
		for (const n of nodes) {
			n.x = Math.min(n.x, width);
			n.y = Math.min(n.y, height);
		}
		draw();
	}

	function step(dt: number) {
		for (const n of nodes) {
			n.x += n.vx * dt;
			n.y += n.vy * dt;
			// Wrap around the edges with a small margin so nodes drift in and out smoothly.
			if (n.x < -20) n.x = width + 20;
			else if (n.x > width + 20) n.x = -20;
			if (n.y < -20) n.y = height + 20;
			else if (n.y > height + 20) n.y = -20;
		}
	}

	function draw() {
		const c = ctx!;
		c.clearRect(0, 0, width, height);
		c.lineWidth = 1;
		c.strokeStyle = colors.line;
		for (let i = 0; i < nodes.length; i++) {
			const a = nodes[i];
			for (let j = i + 1; j < nodes.length; j++) {
				const b = nodes[j];
				const dx = a.x - b.x;
				const dy = a.y - b.y;
				const d2 = dx * dx + dy * dy;
				if (d2 > LINK * LINK) continue;
				c.globalAlpha = 1 - Math.sqrt(d2) / LINK;
				c.beginPath();
				c.moveTo(a.x, a.y);
				c.lineTo(b.x, b.y);
				c.stroke();
			}
		}
		c.globalAlpha = 1;
		c.fillStyle = colors.dot;
		for (const n of nodes) {
			c.beginPath();
			c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
			c.fill();
		}
	}

	function frame(now: number) {
		const dt = Math.min(now - last, 50);
		// Touch devices: about 30 fps is plenty for motion this slow, and saves battery.
		if (touch && dt < 30) {
			raf = requestAnimationFrame(frame);
			return;
		}
		last = now;
		step(dt);
		draw();
		raf = requestAnimationFrame(frame);
	}

	const play = () => {
		if (raf || reduced.matches || document.hidden) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	};
	const pause = () => {
		cancelAnimationFrame(raf);
		raf = 0;
	};

	document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
	reduced.addEventListener("change", () => {
		if (reduced.matches) {
			pause();
			draw();
		} else {
			play();
		}
	});
	let resizeTimer = 0;
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(resize, 150);
	});
	// Light/dark switch: pick up the new colours (redraw now if the loop isn't running).
	new MutationObserver(() => {
		colors = readColors();
		if (!raf) draw();
	}).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	resize();
	play();
}

// The canvas is persisted across client-side navigations, so this only needs to run once.
const canvas = document.querySelector<HTMLCanvasElement>("[data-site-bg]");
if (canvas && !canvas.dataset.ready) {
	canvas.dataset.ready = "true";
	start(canvas);
}

// A module, not a global script, so names like Dot and canvas stay local to this file.
export {};
