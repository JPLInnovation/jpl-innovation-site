/*
 * Camera POV demo layer (scripts/import-camera-pov.mjs inlines this into public/work/drone/camera-pov/index.html,
 * ahead of the ground station's own script).
 *
 * The ground station (github.com/jpl-innovation/drone-f450-jpl-, dashboard/src/index.html) normally runs on the
 * drone's Raspberry Pi and reads live telemetry from it. On the website there is no drone, so this layer:
 *   - answers the page's own requests (the `events` stream, api/history, api/events, healthz) with a simulated flight:
 *     on the pad, arm, take off to 3 m, climb to 10 m, drop to 4 m, fly out and back, land, disarm, repeat.
 *     The message format is exactly what drone_dashboard.py v2.2 sends (fed by reader v2, src/main.cpp).
 *   - draws a simulated camera view under the HUD: a small 3D scene (a field with the landing pad, the pilot, trees,
 *     buildings and the city on the horizon), seen from where the Camera Module 3 hangs, tilted 10° down, with its 41°
 *     view, moving, climbing, tilting and turning with the simulated drone;
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
	// ?t=40 starts the demo 40 s into the flight (for a quick look at the high hover).
	var t0 = performance.now() - (Number(new URLSearchParams(location.search).get("t")) || 0) * 1000;
	var bootAt = Date.now() - 31 * 60 * 1000; // the Pi has been up for half an hour
	var seq = 0;
	var mah = 140;
	var lastT = 0;
	var smooth = function (x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
	var wave = function (t, a, f, p) { return a * Math.sin(t * f + (p || 0)); };
	var BOXES = ["ARM", "ANGLE", "HORIZON", "NAV ALTHOLD", "HEADING HOLD", "HEADFREE", "FAILSAFE", "BEEPER", "OSD OFF", "BLACKBOX"];

	/**
	 * The flight, as altitude keyframes [seconds into the loop, metres]: take off to 3 m, climb to 10 m, drop to 4 m,
	 * fly out and back, land on the pad. Eased between keyframes.
	 */
	var ALT = [[0, 0], [10, 0], [14, 3], [32, 3], [40, 10], [48, 10], [54, 4], [82, 4], [89, 0], [100, 0]];
	function altAt(s) {
		for (var i = 1; i < ALT.length; i++) {
			if (s <= ALT[i][0]) {
				var a = ALT[i - 1], b = ALT[i], u = smooth((s - a[0]) / (b[0] - a[0]));
				return a[1] + (b[1] - a[1]) * u;
			}
		}
		return 0;
	}
	/** Forward flight, 0 to 1: out at heading 110° (56 to 66 s), turn round, back (72 to 82 s). */
	var forwardAt = function (s) { return smooth((s - 56) / 2) * (1 - smooth((s - 64) / 2)) + smooth((s - 72) / 2) * (1 - smooth((s - 80) / 2)); };

	/** Everything the drone does at `s` seconds into the loop (position comes from flightPath, below). */
	function state(s) {
		var armed = s >= 8 && s < 92;
		var flying = s > 10 && s < 89;
		var air = smooth((s - 10.5) / 2) * (1 - smooth((s - 87) / 2)); // how much the air moves it about
		var fwd = forwardAt(s);
		var alt = altAt(s) + (flying ? wave(s, 0.12, 0.7) * air : 0);
		var vs = (altAt(s + 0.1) - altAt(s - 0.1)) / 0.2 + wave(s, 0.06, 0.7, 1.5) * air;
		var roll = air * (wave(s, 2.4, 0.9) + wave(s, 1, 2.3, 1));
		var pitch = air * (wave(s, 1.9, 0.75, 2) + wave(s, 0.8, 2.9)) - fwd * 7;
		var yaw = (40 + smooth((s - 18) / 10) * 70 + smooth((s - 66) / 6) * 180 + smooth((s - 81) / 6) * 110 + 360) % 360;
		var hover = 1540 + 18 * fwd + vs * 55 + wave(s, 12, 1.7);
		var throttle = !armed ? 1000 : !flying ? 1080 : s < 12 ? 1080 + (hover - 1080) * smooth((s - 10) / 2) : hover;
		var load = armed ? Math.max(0, (throttle - 1050) / 500) : 0;
		var amps = !armed ? 0.62 : 0.62 + 1.4 + 11.2 * load * load + wave(s, 0.35, 5.3);
		return { armed: armed, alt: Math.max(0, alt), vs: vs, roll: roll, pitch: pitch, yaw: yaw, throttle: throttle, amps: amps };
	}

	/**
	 * Where the drone is over the ground (x east, z north, metres), worked out once for the whole loop: it drifts with
	 * its tilt and flies where it points; the small error left at the end is spread over the time in the air, so every
	 * flight lands back on the pad and the loop never jumps.
	 */
	var PATH_DT = 0.05;
	var flightPath = (function () {
		var n = Math.round(LOOP / PATH_DT) + 1, xs = new Float32Array(n), zs = new Float32Array(n), x = 0, z = 0;
		for (var k = 0; k < n; k++) {
			var st = state(k * PATH_DT), h = (st.yaw * Math.PI) / 180, on = st.alt > 0.05;
			var ahead = on ? -st.pitch * 0.4 : 0, side = on ? st.roll * 0.15 : 0; // m/s
			x += (Math.sin(h) * ahead + Math.cos(h) * side) * PATH_DT;
			z += (Math.cos(h) * ahead - Math.sin(h) * side) * PATH_DT;
			xs[k] = x;
			zs[k] = z;
		}
		var from = Math.round(10 / PATH_DT), to = Math.round(89 / PATH_DT), ex = xs[to], ez = zs[to];
		for (k = 0; k < n; k++) {
			var u = k <= from ? 0 : k >= to ? 1 : (k - from) / (to - from);
			xs[k] -= ex * u;
			zs[k] -= ez * u;
		}
		return function (s) {
			var i = Math.min(n - 1, Math.max(0, Math.round(s / PATH_DT)));
			return [xs[i], zs[i]];
		};
	})();

	var current = state(0); // what the camera feed shows
	current.pos = [0, 0];
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
		current.pos = flightPath(s);
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

	/* ---------------- the camera view: a small 3D scene ---------------- */
	/*
	 * World: metres, x east, y up, z north; the landing pad at the origin. Everything is flat polygons, spheres and
	 * lines, projected through the drone's camera (10° down from the nose, 41° tall view) and painted far to near, with
	 * haze toward the horizon. Drawn with the 2D canvas, so it needs no WebGL and stays light.
	 */
	var RAD = Math.PI / 180;
	var CAM_TILT = -10; // degrees down: the mount tilts 0 to 45°; 10° keeps some sky in the demo
	var V_FOV = 41; // degrees: the Camera Module 3's vertical view
	var SKY_TOP = [58, 126, 212], SKY_LOW = [196, 218, 236], HAZE = [192, 210, 224];
	var SUN = [Math.sin(250 * RAD) * Math.cos(16 * RAD), Math.sin(16 * RAD), Math.cos(250 * RAD) * Math.cos(16 * RAD)];
	var seed = 7;
	var rand = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
	var mix = function (c, d, k) { return "rgb(" + Math.round(c[0] + (d[0] - c[0]) * k) + "," + Math.round(c[1] + (d[1] - c[1]) * k) + "," + Math.round(c[2] + (d[2] - c[2]) * k) + ")"; };
	var hazeAt = function (dist) { return Math.min(0.85, 1 - Math.exp(-dist / 650)); };

	// The scene, built once.
	var polys = []; // {pts: [[x,y,z],...], color: [r,g,b]}
	var balls = []; // trees: {p: [x,y,z], r, color}
	var poles = []; // tree trunks and the pilot: {a, b, w, color}
	var quad = function (x0, z0, x1, z1, y, color) { polys.push({ pts: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], color: color, flat: true }); };
	quad(-2500, -2500, 2500, 2500, 0, [86, 122, 64]); // the land
	for (var sx = -80; sx < 80; sx += 8) quad(sx, -60, sx + 4, 140, 0.002, [98, 136, 72]); // mowing stripes
	quad(-1.4, -1.4, 1.4, 1.4, 0.01, [176, 172, 160]); // the landing pad
	quad(-0.9, -0.7, -0.6, 0.7, 0.012, [245, 244, 238]); // its H
	quad(0.6, -0.7, 0.9, 0.7, 0.012, [245, 244, 238]);
	quad(-0.6, -0.12, 0.6, 0.12, 0.012, [245, 244, 238]);
	quad(-1, 1.4, 1, 60, 0.004, [150, 132, 98]); // a dirt path from the pad
	quad(-2500, 150, 2500, 162, 0.005, [70, 72, 74]); // the road
	// Buildings by the road, and the city on the horizon: boxes, all four walls and the roof.
	var box = function (x, z, w, d, h, color) {
		var x1 = x + w, z1 = z + d, dark = color.map(function (v) { return v * 0.78; }), lit = color.map(function (v) { return Math.min(255, v * 1.08); });
		polys.push({ pts: [[x, 0, z], [x1, 0, z], [x1, h, z], [x, h, z]], color: dark });
		polys.push({ pts: [[x, 0, z1], [x1, 0, z1], [x1, h, z1], [x, h, z1]], color: color });
		polys.push({ pts: [[x, 0, z], [x, 0, z1], [x, h, z1], [x, h, z]], color: lit });
		polys.push({ pts: [[x1, 0, z], [x1, 0, z1], [x1, h, z1], [x1, h, z]], color: dark });
		polys.push({ pts: [[x, h, z], [x1, h, z], [x1, h, z1], [x, h, z1]], color: lit });
	};
	for (var bx = -160; bx < 180; bx += 26 + rand() * 18) box(bx, 168 + rand() * 6, 14 + rand() * 10, 10 + rand() * 8, 6 + rand() * 12, [196 + rand() * 30, 186 + rand() * 24, 168 + rand() * 20]);
	for (var ang = 0; ang < 360; ang += 7 + rand() * 6) {
		// A low skyline all round, taller toward the city centre (north-east): never more than a couple of degrees high.
		var r = 1600 + rand() * 800, x = Math.sin(ang * RAD) * r, z = Math.cos(ang * RAD) * r;
		box(x, z, 40 + rand() * 60, 40 + rand() * 50, 12 + rand() * (Math.cos((ang - 30) * RAD) > 0.5 ? 70 : 25), [150, 158, 166]);
	}
	// Trees around the field.
	for (var i = 0; i < 70; i++) {
		var ta = rand() * 360, td = 28 + rand() * 120, tx = Math.sin(ta * RAD) * td, tz = Math.cos(ta * RAD) * td;
		if (Math.abs(tx) < 4 && tz > 0 && tz < 70) continue; // keep the path clear
		var th = 3 + rand() * 4, tr = 1.6 + rand() * 1.8, green = [44 + rand() * 30, 82 + rand() * 40, 38 + rand() * 20];
		poles.push({ a: [tx, 0, tz], b: [tx, th, tz], w: 0.35, color: [92, 70, 52] });
		balls.push({ p: [tx, th + tr * 0.6, tz], r: tr, color: green });
		// Its shadow on the grass, thrown away from the low sun.
		var shadow = [];
		for (var sa = 0; sa < 12; sa++) {
			var ca = (sa / 12) * Math.PI * 2;
			shadow.push([tx - SUN[0] * tr * 1.6 + Math.cos(ca) * tr * 1.3, 0.003, tz - SUN[2] * tr * 1.6 + Math.sin(ca) * tr * 0.9]);
		}
		polys.push({ pts: shadow, color: [60, 92, 46], flat: true });
	}
	// The pilot, by the pad with the transmitter: legs, body, head.
	var pilot = [Math.sin(58 * RAD) * 10, Math.cos(58 * RAD) * 10];
	[-0.09, 0.09].forEach(function (o) { poles.push({ a: [pilot[0] + o, 0, pilot[1]], b: [pilot[0] + o, 0.85, pilot[1]], w: 0.13, color: [40, 48, 66] }); });
	poles.push({ a: [pilot[0], 0.88, pilot[1]], b: [pilot[0], 1.42, pilot[1]], w: 0.34, color: [232, 180, 40] }); // a yellow team shirt
	balls.push({ p: [pilot[0], 1.62, pilot[1]], r: 0.12, color: [150, 106, 80] });
	polys.push({ pts: [[pilot[0] - 0.5, 0.003, pilot[1] - 0.2], [pilot[0] + 0.7, 0.003, pilot[1] - 0.4], [pilot[0] + 0.8, 0.003, pilot[1] + 0.3], [pilot[0] - 0.3, 0.003, pilot[1] + 0.3]], color: [64, 96, 50], flat: true });
	// Clouds: far and high, soft.
	var clouds = [];
	for (var ci = 0; ci < 16; ci++) {
		var cang = rand() * 360, cd = 2500 + rand() * 1500;
		clouds.push({ p: [Math.sin(cang * RAD) * cd, 350 + rand() * 450, Math.cos(cang * RAD) * cd], r: 220 + rand() * 260, a: 0.35 + rand() * 0.3 });
	}

	/** The camera for this frame: a function from a world point to [screen x, screen y, depth] (depth <= 0: behind). */
	function cameraFor(st, w, h) {
		var p = st.pos || [0, 0];
		var c = [p[0], st.alt + 0.13, p[1]]; // the lens is about 13 cm off the ground when the drone stands on its legs
		var yaw = st.yaw * RAD, e = (st.pitch + CAM_TILT) * RAD, roll = st.roll * RAD;
		var cy = Math.cos(yaw), sy = Math.sin(yaw), ce = Math.cos(e), se = Math.sin(e), cr = Math.cos(roll), sr = Math.sin(roll);
		var f = h / 2 / Math.tan((V_FOV / 2) * RAD);
		var toCam = function (q) {
			var dx = q[0] - c[0], dy = q[1] - c[1], dz = q[2] - c[2];
			var x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy;
			var y2 = dy * ce - z1 * se, z2 = dy * se + z1 * ce;
			return [x1 * cr + y2 * sr, -x1 * sr + y2 * cr, z2];
		};
		var project = function (v) { return [w / 2 + (f * v[0]) / v[2], h / 2 - (f * v[1]) / v[2]]; };
		return { toCam: toCam, project: project, f: f, at: c };
	}
	var NEAR = 0.05;
	/** Clips a polygon (camera space) to the part in front of the camera. */
	function clipNear(vs) {
		var out = [];
		for (var i = 0; i < vs.length; i++) {
			var a = vs[i], b = vs[(i + 1) % vs.length], ina = a[2] > NEAR, inb = b[2] > NEAR;
			if (ina) out.push(a);
			if (ina !== inb) {
				var k = (NEAR - a[2]) / (b[2] - a[2]);
				out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR]);
			}
		}
		return out;
	}

	function drawScene(g, w, h, st) {
		var cam = cameraFor(st, w, h);
		// Sky: blue above, pale toward the horizon, which tilts with the drone.
		var up = cam.toCam([cam.at[0], cam.at[1] + 1000, cam.at[2]]), ahead = [Math.sin(st.yaw * RAD) * 5000, cam.at[1], Math.cos(st.yaw * RAD) * 5000];
		var hz = cam.toCam([cam.at[0] + ahead[0], ahead[1], cam.at[2] + ahead[2]]);
		var hp = hz[2] > 0 ? cam.project(hz) : [w / 2, -h];
		var dir = [up[0], up[1]], dl = Math.hypot(dir[0], dir[1]) || 1;
		dir = [dir[0] / dl, -dir[1] / dl]; // screen direction of "up"
		var sky = g.createLinearGradient(hp[0], hp[1], hp[0] + dir[0] * h * 1.2, hp[1] + dir[1] * h * 1.2);
		sky.addColorStop(0, mix(SKY_LOW, SKY_LOW, 0));
		sky.addColorStop(0.08, mix(SKY_LOW, SKY_TOP, 0.5));
		sky.addColorStop(0.4, mix(SKY_TOP, SKY_TOP, 0));
		g.fillStyle = sky;
		g.fillRect(0, 0, w, h);
		// The low sun, when it's in view.
		var sun = cam.toCam([cam.at[0] + SUN[0] * 4000, cam.at[1] + SUN[1] * 4000, cam.at[2] + SUN[2] * 4000]);
		if (sun[2] > 0) {
			var sp = cam.project(sun), glow = g.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], h * 0.6);
			glow.addColorStop(0, "rgba(255,244,214,0.95)");
			glow.addColorStop(0.06, "rgba(255,236,190,0.7)");
			glow.addColorStop(1, "rgba(255,226,170,0)");
			g.fillStyle = glow;
			g.fillRect(0, 0, w, h);
		}
		clouds.forEach(function (cl) {
			var v = cam.toCam([cam.at[0] + cl.p[0], cl.p[1], cam.at[2] + cl.p[2]]);
			if (v[2] <= 0) return;
			var cp = cam.project(v), cr2 = (cam.f * cl.r) / v[2];
			g.save();
			g.translate(cp[0], cp[1]);
			g.scale(1, 0.38);
			var cg = g.createRadialGradient(0, 0, 0, 0, 0, cr2);
			cg.addColorStop(0, "rgba(255,255,255," + cl.a + ")");
			cg.addColorStop(0.6, "rgba(250,250,252," + cl.a * 0.55 + ")");
			cg.addColorStop(1, "rgba(250,250,252,0)");
			g.fillStyle = cg;
			g.fillRect(-cr2, -cr2, cr2 * 2, cr2 * 2);
			g.restore();
		});
		// Everything else, far to near.
		var items = [];
		polys.forEach(function (poly) {
			var cs = clipNear(poly.pts.map(cam.toCam));
			if (cs.length < 3) return;
			var mid = [0, 0, 0];
			poly.pts.forEach(function (q) { mid[0] += q[0]; mid[1] += q[1]; mid[2] += q[2]; });
			var n = poly.pts.length, dist = Math.hypot(mid[0] / n - cam.at[0], mid[1] / n - cam.at[1], mid[2] / n - cam.at[2]);
			// Flat ground pieces always sit under what stands on them.
			items.push({ d: poly.flat ? 1e9 - poly.pts[0][1] * 1e6 : dist, dist: dist, kind: 0, cs: cs, color: poly.color });
		});
		balls.forEach(function (b) {
			var v = cam.toCam(b.p);
			if (v[2] > NEAR) items.push({ d: v[2], dist: v[2], kind: 1, v: v, r: b.r, color: b.color });
		});
		poles.forEach(function (pl) {
			var a = cam.toCam(pl.a), b = cam.toCam(pl.b);
			if (a[2] > NEAR && b[2] > NEAR) items.push({ d: (a[2] + b[2]) / 2, dist: (a[2] + b[2]) / 2, kind: 2, a: a, b: b, w: pl.w, color: pl.color });
		});
		items.sort(function (p, q) { return q.d - p.d; });
		var hazed = false;
		items.forEach(function (it) {
			if (!hazed && it.d < 1e8) {
				// Haze over the far ground, so the land fades into the sky instead of meeting it at a hard line.
				hazed = true;
				var band = g.createLinearGradient(hp[0], hp[1], hp[0] - dir[0] * h * 0.2, hp[1] - dir[1] * h * 0.2);
				band.addColorStop(0, "rgba(" + HAZE.join(",") + ",0.8)");
				band.addColorStop(1, "rgba(" + HAZE.join(",") + ",0)");
				g.fillStyle = band;
				g.fillRect(0, 0, w, h);
			}
			var k = hazeAt(it.dist);
			g.fillStyle = g.strokeStyle = mix(it.color, HAZE, k);
			if (it.kind === 0) {
				g.beginPath();
				it.cs.forEach(function (v, i) { var s2 = cam.project(v); if (i) g.lineTo(s2[0], s2[1]); else g.moveTo(s2[0], s2[1]); });
				g.closePath();
				g.fill();
			} else if (it.kind === 1) {
				var c2 = cam.project(it.v), rr = (cam.f * it.r) / it.v[2];
				if (rr < 0.4) return;
				g.beginPath();
				g.arc(c2[0], c2[1], rr, 0, Math.PI * 2);
				g.fill();
				// Light from the sun's side.
				g.fillStyle = "rgba(255,240,200," + (0.16 * (1 - k)).toFixed(3) + ")";
				g.beginPath();
				g.arc(c2[0] - rr * 0.3, c2[1] - rr * 0.3, rr * 0.6, 0, Math.PI * 2);
				g.fill();
			} else {
				var pa = cam.project(it.a), pb = cam.project(it.b);
				g.lineWidth = Math.max(1, (cam.f * it.w) / it.d);
				g.lineCap = "round";
				g.beginPath();
				g.moveTo(pa[0], pa[1]);
				g.lineTo(pb[0], pb[1]);
				g.stroke();
			}
		});
	}

	window.GS_DEMO = {
		/** Called by the page's videoStart() in place of the WebRTC connection. Returns a function that stops it. */
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
			setState("demo feed (simulated scene)");
			var g = canvas.getContext("2d");
			var noise = document.createElement("canvas");
			noise.width = 192;
			noise.height = 108;
			var ng = noise.getContext("2d");
			var running = true;
			var draw = function () {
				if (!running || canvas.hidden) return;
				var dpr = Math.min(1.5, devicePixelRatio || 1);
				var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
				if (canvas.width !== w) canvas.width = w;
				if (canvas.height !== h) canvas.height = h;
				if (w && h) {
					var st = current;
					// A little vibration from the props while the motors run.
					var shake = st.armed ? 0.25 : 0;
					drawScene(g, w, h, {
						pos: st.pos, alt: st.alt, yaw: st.yaw,
						pitch: st.pitch + (Math.random() - 0.5) * shake, roll: st.roll + (Math.random() - 0.5) * shake,
					});
					// Sensor grain and a soft vignette, so it reads as a small camera.
					var px = ng.createImageData(192, 108);
					for (var i = 0; i < px.data.length; i += 4) {
						px.data[i] = px.data[i + 1] = px.data[i + 2] = Math.random() * 255;
						px.data[i + 3] = 12;
					}
					ng.putImageData(px, 0, 0);
					g.imageSmoothingEnabled = false;
					g.drawImage(noise, 0, 0, w, h);
					g.imageSmoothingEnabled = true;
					var vg = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.75);
					vg.addColorStop(0, "rgba(0,0,0,0)");
					vg.addColorStop(1, "rgba(0,0,0,0.45)");
					g.fillStyle = vg;
					g.fillRect(0, 0, w, h);
				}
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
