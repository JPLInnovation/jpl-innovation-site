/**
 * Animated site background: a slow starfield in blue and purple, drawn on the persistent
 * <canvas data-site-bg> in BaseLayout, plus a soft purple glow that trails the mouse (.site-bg__glow).
 * The colour washes behind it are pure CSS (global.css).
 *
 * Meant to feel calm, not busy:
 * - Stars sit at three depths. Near ones drift a little faster and shift a little more with the cursor,
 *   which gives depth without anything jumping around. Twinkle is gentle, and there is a rare, faint shooting star.
 * - The glow follows the mouse with easing, so it glides rather than sticks. Mouse and trackpad only.
 * - Lightweight: one 2D canvas, no libraries. Touch devices get fewer stars, a 30 fps cap and a 1x pixel ratio.
 * - Pauses whenever the tab is hidden.
 * - prefers-reduced-motion: one still frame of stars, no glow, no shooting stars (and it reacts if the setting changes).
 * - Colours come from --bg-star / --bg-star-alt / --bg-shoot, so it follows light/dark mode (kept faint for WCAG AA).
 */
type Star = { x: number; y: number; z: number; r: number; phase: number; alt: boolean };
type Shooter = { x: number; y: number; vx: number; vy: number; life: number };

const DRIFT = 0.012; // px per ms for the nearest stars (~12 px/s); far stars move a quarter of that
const PARALLAX = 18; // px the nearest stars shift when the cursor is at the edge of the screen

function start(canvas: HTMLCanvasElement, glow: HTMLElement | null) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	const touch = matchMedia("(pointer: coarse)").matches;
	const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

	let width = 0;
	let height = 0;
	let stars: Star[] = [];
	let shooter: Shooter | null = null;
	let nextShooter = 0;
	let raf = 0;
	let last = 0;
	let colors = readColors();

	// Cursor, eased: `target` jumps with the mouse, `eased` glides toward it every frame.
	const target = { x: 0.5, y: 0.35, on: false };
	const eased = { x: 0.5, y: 0.35, alpha: 0 };

	function readColors() {
		const style = getComputedStyle(document.documentElement);
		const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
		return {
			star: read("--bg-star", "rgb(29 78 216 / 0.35)"),
			alt: read("--bg-star-alt", "rgb(124 58 237 / 0.35)"),
			shoot: read("--bg-shoot", "rgb(124 58 237 / 0.5)"),
		};
	}

	const makeStar = (): Star => {
		const z = [0.35, 0.6, 1][Math.floor(Math.random() * 3)]; // three depth layers
		return {
			x: Math.random() * width,
			y: Math.random() * height,
			z,
			r: (0.5 + Math.random() * 0.8) * (0.6 + z * 0.7),
			phase: Math.random() * Math.PI * 2,
			alt: Math.random() < 0.3, // about a third are purple
		};
	};

	function resize() {
		const dpr = touch ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
		// Roughly one star per 9,000 px², capped so phones and huge screens both stay cheap.
		const count = Math.min(touch ? 70 : 170, Math.max(30, Math.round((width * height) / 9000)));
		while (stars.length < count) stars.push(makeStar());
		stars.length = count;
		for (const s of stars) {
			s.x = Math.min(s.x, width);
			s.y = Math.min(s.y, height);
		}
		draw(performance.now());
	}

	function step(dt: number, now: number) {
		// Drift up and to the left, as if flying slowly forward through the field.
		for (const s of stars) {
			s.x -= DRIFT * s.z * dt;
			s.y -= DRIFT * 0.35 * s.z * dt;
			if (s.x < -30) s.x = width + 30;
			if (s.y < -30) s.y = height + 30;
		}
		// Cursor easing (frame-rate independent).
		const k = 1 - Math.exp(-dt / 140);
		eased.x += (target.x - eased.x) * k;
		eased.y += (target.y - eased.y) * k;
		eased.alpha += ((target.on ? 1 : 0) - eased.alpha) * (1 - Math.exp(-dt / 320));
		// A faint shooting star every 12–25 s.
		if (!shooter && now > nextShooter) {
			const fromLeft = Math.random() < 0.5;
			shooter = {
				x: fromLeft ? Math.random() * width * 0.5 : width * (0.5 + Math.random() * 0.5),
				y: Math.random() * height * 0.4,
				vx: (fromLeft ? 1 : -1) * (0.55 + Math.random() * 0.2),
				vy: 0.22 + Math.random() * 0.1,
				life: 0,
			};
			nextShooter = now + 12000 + Math.random() * 13000;
		}
		if (shooter) {
			shooter.x += shooter.vx * dt;
			shooter.y += shooter.vy * dt;
			shooter.life += dt;
			if (shooter.life > 1100) shooter = null;
		}
	}

	function draw(now: number) {
		const c = ctx!;
		c.clearRect(0, 0, width, height);
		const still = reduced.matches;
		// Cursor parallax: near stars shift more than far ones (centre of the screen = no shift).
		const px = still ? 0 : (eased.x - 0.5) * -2 * PARALLAX;
		const py = still ? 0 : (eased.y - 0.5) * -2 * PARALLAX;
		for (const s of stars) {
			const twinkle = still ? 0.85 : 0.7 + 0.3 * Math.sin(now * 0.0012 * (0.6 + s.z) + s.phase);
			const x = s.x + px * s.z;
			const y = s.y + py * s.z;
			c.globalAlpha = twinkle * (0.45 + s.z * 0.55);
			c.fillStyle = s.alt ? colors.alt : colors.star;
			c.beginPath();
			c.arc(x, y, s.r, 0, Math.PI * 2);
			c.fill();
			// The nearest, brightest stars get a soft halo.
			if (s.z === 1 && s.r > 1.1) {
				c.globalAlpha *= 0.18;
				c.beginPath();
				c.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
				c.fill();
			}
		}
		if (shooter && !still) {
			const fade = Math.sin((shooter.life / 1100) * Math.PI); // in, then out
			const tail = 90;
			const len = Math.hypot(shooter.vx, shooter.vy);
			const tx = shooter.x - (shooter.vx / len) * tail;
			const ty = shooter.y - (shooter.vy / len) * tail;
			const gradient = c.createLinearGradient(shooter.x, shooter.y, tx, ty);
			gradient.addColorStop(0, colors.shoot);
			gradient.addColorStop(1, "transparent");
			c.globalAlpha = fade;
			c.strokeStyle = gradient;
			c.lineWidth = 1.4;
			c.lineCap = "round";
			c.beginPath();
			c.moveTo(shooter.x, shooter.y);
			c.lineTo(tx, ty);
			c.stroke();
		}
		c.globalAlpha = 1;
		if (glow) {
			// Transform + opacity only, so the glow stays on the GPU.
			glow.style.transform = `translate3d(${eased.x * width}px, ${eased.y * height}px, 0) translate(-50%, -50%)`;
			glow.style.opacity = String(still ? 0 : eased.alpha);
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
		step(dt, now);
		draw(now);
		raf = requestAnimationFrame(frame);
	}

	const play = () => {
		if (raf || reduced.matches || document.hidden) return;
		last = performance.now();
		if (!nextShooter) nextShooter = last + 6000 + Math.random() * 6000;
		raf = requestAnimationFrame(frame);
	};
	const pause = () => {
		cancelAnimationFrame(raf);
		raf = 0;
	};

	// Mouse and trackpad only: touch screens don't get the glow or the parallax.
	const onMove = (event: PointerEvent) => {
		if (event.pointerType !== "mouse" || !finePointer.matches) return;
		target.x = event.clientX / width;
		target.y = event.clientY / height;
		target.on = true;
	};
	addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => (target.on = false));
	addEventListener("blur", () => (target.on = false));

	document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
	reduced.addEventListener("change", () => {
		if (reduced.matches) {
			pause();
			draw(performance.now());
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
		if (!raf) draw(performance.now());
	}).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	resize();
	play();
}

// The canvas is persisted across client-side navigations, so this only needs to run once.
const canvas = document.querySelector<HTMLCanvasElement>("[data-site-bg]");
if (canvas && !canvas.dataset.ready) {
	canvas.dataset.ready = "true";
	start(canvas, document.querySelector<HTMLElement>("[data-site-glow]"));
}

// A module, not a global script, so names like Star and canvas stay local to this file.
export {};
