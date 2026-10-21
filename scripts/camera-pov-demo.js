/*
 * Camera POV demo layer (scripts/import-camera-pov.mjs inlines this into public/work/drone/camera-pov/index.html,
 * ahead of the ground station's own script).
 *
 * The ground station (github.com/jpl-innovation/drone-f450-jpl-, dashboard/src/index.html) normally runs on the
 * drone's Raspberry Pi and reads live telemetry from it. On the website there is no drone, so this layer:
 *   - answers the page's own requests (the `events` stream, api/history, api/events, healthz) with a simulated flight:
 *     on the ground, arm, climb to about 2.5 m, hover and drift, a short slow flight forward, land, disarm, repeat.
 *     The message format is exactly what drone_dashboard.py v2.2 sends (fed by reader v2, src/main.cpp).
 *   - draws a simulated camera feed under the HUD, tilting and turning with the simulated drone;
 *   - checks whether the real drone is online (LIVE_URL below, or ?live=https://… in the address) and, if it answers,
 *     offers a link to the real ground station.
 * The numbers follow the build guide's estimates (3S 2200 mAh, about 13 A in a hover, 54 to 62 % throttle). The
 * drone hasn't flown yet: the banner says this is a simulation.
 */
(function () {
	"use strict";

	/** The drone's public ground station (Tailscale Funnel), e.g. "https://drone.your-tailnet.ts.net". Empty: none yet. */
	var LIVE_URL = "";

	var params = new URLSearchParams(location.search);
	var live = (params.get("live") || LIVE_URL || "").replace(/\/+$/, "");

	/* ---------------- the simulated flight ---------------- */
	var LOOP = 100; // seconds per flight
	var t0 = performance.now();
	var bootAt = Date.now() - 31 * 60 * 1000; // the Pi has been up for half an hour
	var seq = 0;
	var mah = 140;
	var lastT = 0;
	var smooth = function (x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
	var wave = function (t, a, f, p) { return a * Math.sin(t * f + (p || 0)); };
	var BOXES = ["ARM", "ANGLE", "HORIZON", "NAV ALTHOLD", "HEADING HOLD", "HEADFREE", "FAILSAFE", "BEEPER", "OSD OFF", "BLACKBOX"];

	/** Everything the drone does at `s` seconds into the loop. */
	function state(s) {
		var armed = s >= 8 && s < 92;
		var climb = smooth((s - 10) / 4) * (1 - smooth((s - 82) / 8)); // 0 on the ground, 1 at hover height
		var cruise = smooth((s - 60) / 3) * (1 - smooth((s - 74) / 3)); // the short flight forward
		var alt = 2.5 * climb + (climb > 0.98 ? wave(s, 0.18, 0.7) : 0);
		var vs = s > 10 && s < 14 ? 0.62 : s > 82 && s < 90 ? -0.31 : wave(s, 0.12, 0.7, 1.5) * climb;
		var roll = climb * (wave(s, 2.6, 0.9) + wave(s, 1.1, 2.3, 1)) + cruise * wave(s, 7, 0.35);
		var pitch = climb * (wave(s, 2.1, 0.75, 2) + wave(s, 0.9, 2.9)) - cruise * 8;
		var yaw = (40 + (s > 20 ? smooth((s - 20) / 12) * 70 : 0) - (s > 64 ? smooth((s - 64) / 14) * 95 : 0) + 360) % 360;
		var hover = 1540 + 20 * cruise + wave(s, 14, 1.7);
		var throttle = !armed ? 1000 : s < 10 ? 1080 : s < 14 ? 1080 + (hover - 1080) * smooth((s - 10) / 2) : s > 88 ? 1150 : hover - (s > 82 ? 70 : 0);
		var load = armed ? Math.max(0, (throttle - 1050) / 500) : 0;
		var amps = !armed ? 0.62 : 0.62 + 1.4 + 11.2 * load * load + wave(s, 0.35, 5.3);
		return { armed: armed, alt: alt, vs: vs, roll: roll, pitch: pitch, yaw: yaw, throttle: throttle, amps: amps };
	}

	var current = state(0); // what the camera feed shows
	var events = [];
	var eventId = 1;
	var nextEvents = [];
	var armedSince = null;
	var armedTotal = 0;
	var wasArmed = false;
	function addEvent(level, msg) {
		var e = { id: eventId++, ts: Date.now() / 1000, level: level, msg: msg };
		events.push(e);
		nextEvents.push(e);
		if (events.length > 200) events.shift();
	}
	addEvent("info", "Telemetry connected (demo: a simulated flight, not the real drone)");

	/** One message, as drone_dashboard.py's `events` stream sends it. */
	function message(slow) {
		var now = performance.now();
		var elapsed = (now - t0) / 1000;
		var s = elapsed % LOOP;
		var dt = lastT ? Math.min(0.5, elapsed - lastT) : 0;
		lastT = elapsed;
		var st = state(s);
		current = st;
		mah += (st.amps * dt * 1000) / 3600;
		if (mah > 1500) mah = 140; // a fresh pack
		var rest = 12.55 - (mah / 2200) * 1.25;
		var volts = rest - st.amps * 0.028 + wave(elapsed, 0.01, 7);
		if (st.armed && !wasArmed) {
			armedSince = elapsed;
			addEvent("warn", "ARMED");
		}
		if (!st.armed && wasArmed) {
			var dur = elapsed - armedSince;
			armedTotal += dur;
			armedSince = null;
			addEvent("info", "Disarmed after " + Math.floor(dur / 60) + ":" + String(Math.floor(dur % 60)).padStart(2, "0"));
		}
		wasArmed = st.armed;
		// Quad-X mixing, so the four motors move apart as the drone tilts and turns (M1 rear right, M2 front right,
		// M3 rear left, M4 front left, the INAV order).
		var r = st.roll * 6, p = st.pitch * 6, y = wave(elapsed, 18, 0.5);
		var motors = st.armed
			? [st.throttle - r + p - y, st.throttle - r - p + y, st.throttle + r + p + y, st.throttle + r - p - y].map(function (m) {
					return Math.round(Math.min(2000, Math.max(1000, m)));
				})
			: [1000, 1000, 1000, 1000];
		var rc = [
			Math.round(1500 + st.roll * 9),
			Math.round(1500 - st.pitch * 9),
			Math.round(1500 + wave(elapsed, 30, 0.5)),
			Math.round(st.throttle),
			st.armed ? 2000 : 1000, // arm switch
			1000, // ANGLE (the mode switch's low position)
			1500,
			1000,
		];
		var rad = Math.PI / 180;
		var tele = {
			type: "t",
			seq: ++seq,
			att: { roll: +st.roll.toFixed(1), pitch: +st.pitch.toFixed(1), yaw: Math.round(st.yaw), age: 12 },
			bat: {
				v: +volts.toFixed(2), a: +st.amps.toFixed(2), w: +(volts * st.amps).toFixed(2), mah: Math.round(mah),
				mwh: Math.round(mah * 11.4), remain: Math.round(2200 - mah), pct: Math.round(100 * (1 - mah / 2200)),
				cells: 3, state: 0, src: "v2", age: 60,
			},
			rssi: Math.round(1008 + wave(elapsed, 9, 0.8) - (st.armed ? 6 : 0)),
			status: {
				cycle: 500, i2c: 0, sensors: 0x27, load: st.armed ? 14 : 11, profile: 0, arming: 0,
				modes_lo: (st.armed ? 1 : 0) | 2, modes_hi: 0, src: "v2", age: 95,
			},
			motors: motors,
			motor_age: 40,
			rc: rc,
			rc_age: 40,
			imu: {
				acc: [+(-Math.sin(st.pitch * rad)).toFixed(3), +Math.sin(st.roll * rad).toFixed(3), +(Math.cos(st.roll * rad) * Math.cos(st.pitch * rad) + wave(elapsed, 0.02, 31)).toFixed(3)],
				gyro: [Math.round(wave(elapsed, 6, 0.9) * (st.armed ? 1 : 0.1)), Math.round(wave(elapsed, 5, 0.75, 2) * (st.armed ? 1 : 0.1)), Math.round(wave(elapsed, 4, 0.5))],
				mag: [Math.round(210 * Math.cos(st.yaw * rad)), Math.round(-210 * Math.sin(st.yaw * rad)), -380],
				age: 25,
			},
			alt: { m: +st.alt.toFixed(2), vs: +st.vs.toFixed(2), baro: +(st.alt + 0.04).toFixed(2), age: 30 },
			rates: { att: 50, bat: 10, motor: 10, rc: 10, imu: 10, alt: 10, status: 10, req: 112, timeouts: 0, bad: 0 },
			api: "2.5",
		};
		var msg = {
			seq: seq,
			src: "demo (simulated)",
			age: 0.03,
			tele: tele,
			flight: { armed: st.armed, armed_for: armedSince != null ? +(elapsed - armedSince).toFixed(1) : 0, total: +(armedTotal + (armedSince != null ? elapsed - armedSince : 0)).toFixed(1) },
			rc: { state: "ok", lq: Math.round(Math.min(Math.max(tele.rssi, 0), 1023) * 100 / 1023), losses: 0, min_lq: 97, weak: false, since_loss: null, lost_for: null },
			server_time: Date.now() / 1000,
		};
		if (slow) {
			msg.pi = {
				temp: +(53 + (st.armed ? 3 : 0) + wave(elapsed, 0.6, 0.2)).toFixed(1),
				throttled: 0,
				load: [0.42, 0.38, 0.35],
				mem_used_pct: 31,
				uptime: Math.round((Date.now() - bootAt) / 1000),
				cpu_pct: Math.round(24 + wave(elapsed, 4, 0.9)),
				net: [{ name: "eth0", up: false }, { name: "tailscale0", up: true }, { name: "wlan0", up: true, dbm: -61 }, { name: "wwan0", up: true }],
			};
			msg.meta = { type: "meta", boxnames: BOXES, api: "2.5", bat_src: "v2", status_src: "v2" };
			msg.ver = "2.2 · demo";
		}
		if (nextEvents.length) {
			msg.events = nextEvents;
			nextEvents = [];
		}
		return msg;
	}

	/* ---------------- the page's requests, answered here ---------------- */
	function DemoEventSource(url) {
		var hz = Math.max(1, Math.min(50, Number((String(url).match(/hz=([\d.]+)/) || [])[1]) || 25));
		var self = this;
		var lastSlow = 0;
		this.readyState = 1;
		this.onmessage = null;
		this._timer = setInterval(function () {
			var now = performance.now();
			var slow = now - lastSlow >= 1000;
			if (slow) lastSlow = now;
			var m = message(slow);
			if (self.onmessage) self.onmessage({ data: JSON.stringify(m) });
		}, 1000 / hz);
	}
	DemoEventSource.prototype.close = function () {
		clearInterval(this._timer);
		this.readyState = 2;
	};
	DemoEventSource.prototype.addEventListener = function () {};
	window.EventSource = DemoEventSource;

	var realFetch = window.fetch.bind(window);
	var json = function (obj) { return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } }); };
	window.fetch = function (input, init) {
		var url = typeof input === "string" ? input : input && input.url;
		if (/^healthz/.test(url)) return new Promise(function (resolve) { setTimeout(function () { resolve(new Response("ok\n")); }, 35); });
		if (/^api\/events/.test(url)) return Promise.resolve(json(events.slice()));
		if (/^api\/history/.test(url)) {
			// The last 20 s on the ground before the page opened, at 5 Hz.
			var h = { t: [], v: [], a: [], m1: [], m2: [], m3: [], m4: [], alt: [], lq: [] };
			for (var i = 0; i < 100; i++) {
				h.t.push(Date.now() / 1000 - (100 - i) / 5);
				h.v.push(12.48 + wave(i, 0.01, 0.7)); h.a.push(0.62);
				h.m1.push(1000); h.m2.push(1000); h.m3.push(1000); h.m4.push(1000);
				h.alt.push(0); h.lq.push(99);
			}
			return Promise.resolve(json(h));
		}
		return realFetch(input, init);
	};

	/* ---------------- the camera feed ---------------- */
	window.GS_DEMO = {
		/** Called by the page's videoStart() in place of the WebRTC connection. */
		video: function (setState) {
			var screen = document.getElementById("screen");
			var vid = document.getElementById("vid");
			var canvas = document.getElementById("demoFeed");
			if (!canvas) {
				canvas = document.createElement("canvas");
				canvas.id = "demoFeed";
				canvas.setAttribute("aria-hidden", "true");
				screen.insertBefore(canvas, document.getElementById("hud"));
			}
			vid.hidden = true;
			canvas.hidden = false;
			setState("demo feed (simulated)");
			var img = new Image();
			img.src = "feed.webp";
			var g = canvas.getContext("2d");
			var noise = document.createElement("canvas");
			noise.width = 160;
			noise.height = 90;
			var ng = noise.getContext("2d");
			var running = true;
			var draw = function () {
				if (!running || canvas.hidden) return;
				var w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
				if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
				if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
				var st = current, t = (performance.now() - t0) / 1000;
				g.setTransform(1, 0, 0, 1, 0, 0);
				g.fillStyle = "#020607";
				g.fillRect(0, 0, canvas.width, canvas.height);
				if (img.complete && img.naturalWidth) {
					// The camera hangs under the front, tilted 15° down: the horizon sits above the middle, moves with pitch,
					// turns against the roll, and the ground comes closer as the drone climbs.
					var cover = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight) * (1.55 + st.alt * 0.04);
					var ppd = canvas.height / 41; // the Camera Module 3's 41° vertical view
					g.translate(canvas.width / 2, canvas.height / 2);
					g.rotate((-st.roll * Math.PI) / 180);
					g.translate(-(((st.yaw * 3) % 360) / 360) * canvas.width * 0.08, (st.pitch + 2) * ppd - canvas.height * 0.06 + st.alt * ppd * 0.4);
					g.drawImage(img, (-img.naturalWidth * cover) / 2, (-img.naturalHeight * cover) / 2, img.naturalWidth * cover, img.naturalHeight * cover);
					g.setTransform(1, 0, 0, 1, 0, 0);
				}
				// Sensor noise and a soft vignette, so it reads as a small camera and not a picture.
				var px = ng.createImageData(160, 90);
				for (var i = 0; i < px.data.length; i += 4) {
					var n = Math.random() * 255;
					px.data[i] = px.data[i + 1] = px.data[i + 2] = n;
					px.data[i + 3] = 22;
				}
				ng.putImageData(px, 0, 0);
				g.imageSmoothingEnabled = false;
				g.drawImage(noise, 0, 0, canvas.width, canvas.height);
				g.imageSmoothingEnabled = true;
				var vg = g.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.72);
				vg.addColorStop(0, "rgba(0,0,0,0)");
				vg.addColorStop(1, "rgba(0,0,0,0.55)");
				g.fillStyle = vg;
				g.fillRect(0, 0, canvas.width, canvas.height);
				requestAnimationFrame(draw);
			};
			requestAnimationFrame(draw);
			return function stop() {
				running = false;
				canvas.hidden = true;
			};
		},
	};

	/* ---------------- the real drone, when it's online ---------------- */
	document.addEventListener("DOMContentLoaded", function () {
		var bar = document.getElementById("povLive");
		if (!bar || !live) return;
		// A no-cors request can't read the answer, but it only resolves if the drone's server is there at all.
		var timeout = new Promise(function (_, reject) { setTimeout(reject, 5000); });
		Promise.race([realFetch(live + "/healthz?t=" + Date.now(), { mode: "no-cors", cache: "no-store" }), timeout]).then(
			function () {
				bar.hidden = false;
				bar.querySelector("a").href = live + "/";
			},
			function () {},
		);
	});
})();
