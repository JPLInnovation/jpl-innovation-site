/**
 * A small CCNA lab network in 3D, with live traffic:
 *   - allowed internet traffic passes the ACL and reaches a PC on VLAN 10
 *   - a blocked packet is dropped at the ACL (the shield flashes)
 *   - inter-VLAN routing: a packet from VLAN 10 changes to VLAN 20's colour as the L3 switch routes it
 *   - a DHCP/DNS request from VLAN 20 goes to the Windows Server and the reply comes back
 * Colours come from the site's categorical chart palette (--chart-1..4).
 */
import {
	CanvasTexture,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	Group,
	BufferGeometry,
	Float32BufferAttribute,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	QuadraticBezierCurve3,
	SphereGeometry,
	SRGBColorSpace,
	TorusGeometry,
	TubeGeometry,
	Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { type Model, type Palette, type StageContext, type StageView, standard } from "../stage";

export const view: StageView = {
	camera: [0.5, 2.5, 3.9],
	target: [0.05, 0, 0.05],
	fov: 34,
	minPolar: 0.3,
	maxPolar: 1.25,
	fitWidth: 5.2,
};

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

// Where cables meet each device.
const P = {
	internet: v(-2.1, 0.34, 0),
	acl: v(-1.42, 0.3, 0),
	router: v(-0.75, 0.09, 0),
	l3: v(0.15, 0.07, 0),
	server: v(0.15, 0.1, -0.76),
	l2a: v(1.15, 0.05, -0.55),
	l2b: v(1.15, 0.05, 0.55),
	a1: v(1.9, 0.05, -0.9),
	a2: v(1.9, 0.05, -0.3),
	b1: v(1.9, 0.05, 0.3),
	b2: v(1.9, 0.05, 0.9),
};
type Node = keyof typeof P;

const LINKS: Array<[Node, Node]> = [
	["internet", "acl"],
	["acl", "router"],
	["router", "l3"],
	["l3", "server"],
	["l3", "l2a"],
	["l3", "l2b"],
	["l2a", "a1"],
	["l2a", "a2"],
	["l2b", "b1"],
	["l2b", "b2"],
];

/** A packet's trip: the nodes it visits, its colour per hop, when it leaves (s into the cycle), and whether the ACL drops it. */
interface Flow {
	route: Node[];
	colors: number[]; // chart index per hop
	start: number;
	blocked?: boolean;
}
const CYCLE = 9;
const FLOWS: Flow[] = [
	{ route: ["internet", "acl", "router", "l3", "l2a", "a1"], colors: [2, 2, 2, 2, 2], start: 0 },
	{ route: ["internet", "acl"], colors: [3], start: 1.4, blocked: true },
	{ route: ["a2", "l2a", "l3", "l2b", "b1"], colors: [0, 0, 1, 1], start: 2.8 },
	{ route: ["b2", "l2b", "l3", "server"], colors: [1, 1, 1], start: 4.6 },
	{ route: ["server", "l3", "l2b", "b2"], colors: [1, 1, 1], start: 6.3 },
	{ route: ["internet", "acl"], colors: [3], start: 7.2, blocked: true },
];
const SPEED = 1.15; // scene units per second

export default function createNetwork(ctx: StageContext): Model {
	const body = standard(0x1b2433, { metalness: 0.45, roughness: 0.4 });
	const scene = new Group();
	ctx.root.add(scene);

	/* ---------- Bench and grid ---------- */
	const benchMaterial = standard(0xffffff, { roughness: 0.85 });
	const bench = new Mesh(new RoundedBoxGeometry(5.2, 0.04, 2.9, 3, 0.02), benchMaterial);
	bench.position.set(0.05, -0.022, 0);
	scene.add(bench);
	// Grid lines every 0.2 units, clipped to the bench.
	const gridPoints: number[] = [];
	for (let x = -2.5; x <= 2.501; x += 0.2) gridPoints.push(x + 0.05, 0.001, -1.4, x + 0.05, 0.001, 1.4);
	for (let z = -1.4; z <= 1.401; z += 0.2) gridPoints.push(-2.45, 0.001, z, 2.55, 0.001, z);
	const gridGeometry = new BufferGeometry();
	gridGeometry.setAttribute("position", new Float32BufferAttribute(gridPoints, 3));
	const gridMaterial = new LineBasicMaterial({ transparent: true });
	scene.add(new LineSegments(gridGeometry, gridMaterial));

	/* ---------- Cables ---------- */
	const cableMaterial = standard(0x6d7a8c, { roughness: 0.6 });
	const curves = new Map<string, QuadraticBezierCurve3>();
	for (const [a, b] of LINKS) {
		const from = P[a];
		const to = P[b];
		const mid = from.clone().lerp(to, 0.5);
		mid.y = Math.max(from.y, to.y) + 0.08;
		const curve = new QuadraticBezierCurve3(from, mid, to);
		curves.set(`${a}>${b}`, curve);
		scene.add(new Mesh(new TubeGeometry(curve, 24, 0.009, 6), cableMaterial));
	}
	const segment = (a: Node, b: Node) => {
		const forward = curves.get(`${a}>${b}`);
		if (forward) return (u: number) => forward.getPointAt(u);
		const backward = curves.get(`${b}>${a}`)!;
		return (u: number) => backward.getPointAt(1 - u);
	};

	/* ---------- Devices ---------- */
	// Internet: a soft cloud of spheres
	const cloud = new Group();
	cloud.position.set(-2.1, 0.55, 0);
	scene.add(cloud);
	const cloudMaterial = standard(0xb9c5d3, { roughness: 0.95 });
	for (const [x, y, z, r] of [
		[0, 0.05, 0, 0.2],
		[-0.19, -0.02, 0.05, 0.15],
		[0.18, -0.02, -0.04, 0.16],
		[0.06, 0.02, 0.15, 0.14],
		[-0.05, -0.04, -0.15, 0.13],
	]) {
		const puff = new Mesh(new SphereGeometry(r, 24, 16), cloudMaterial);
		puff.position.set(x, y, z);
		cloud.add(puff);
	}

	// ACL: a hexagonal shield the cable passes through
	const shieldFill = new MeshBasicMaterial({ transparent: true, opacity: 0.16, side: DoubleSide, depthWrite: false });
	const shieldEdge = new MeshBasicMaterial({});
	const shield = new Group();
	shield.position.copy(P.acl);
	shield.rotation.y = Math.PI / 2;
	scene.add(shield);
	const hexFill = new Mesh(new CircleGeometry(0.26, 6), shieldFill);
	hexFill.rotation.z = Math.PI / 6;
	shield.add(hexFill);
	const hexEdge = new Mesh(new TorusGeometry(0.26, 0.009, 6, 6), shieldEdge);
	hexEdge.rotation.z = Math.PI / 6;
	shield.add(hexEdge);

	// Router: the classic puck with four arrows on top
	const router = new Mesh(new CylinderGeometry(0.22, 0.22, 0.14, 40), body);
	router.position.set(-0.75, 0.07, 0);
	scene.add(router);
	const arrows = new Mesh(new CircleGeometry(0.2, 40), new MeshBasicMaterial({ map: routerArrows(), transparent: true }));
	arrows.rotation.x = -Math.PI / 2;
	arrows.position.y = 0.0705;
	router.add(arrows);

	// Switches, with blinking port LEDs
	const leds: Array<{ mesh: Mesh; chart: number; seed: number }> = [];
	const ledGeometry = new PlaneGeometry(0.022, 0.014);
	const makeSwitch = (size: [number, number, number], at: Vector3, ports: number, chartFor: (i: number) => number, stripe?: number) => {
		const sw = new Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, 0.012), body);
		sw.position.set(at.x, size[1] / 2, at.z);
		scene.add(sw);
		for (let i = 0; i < ports; i++) {
			const mesh = new Mesh(ledGeometry, new MeshBasicMaterial());
			mesh.position.set(-size[0] / 2 + 0.06 + (i * (size[0] - 0.12)) / (ports - 1), 0, size[2] / 2 + 0.001);
			sw.add(mesh);
			leds.push({ mesh, chart: chartFor(i), seed: Math.random() * 10 });
		}
		if (stripe !== undefined) {
			const band = new Mesh(new PlaneGeometry(size[0] - 0.04, 0.03), new MeshBasicMaterial());
			band.rotation.x = -Math.PI / 2;
			band.position.set(0, size[1] / 2 + 0.001, 0);
			sw.add(band);
			leds.push({ mesh: band, chart: stripe, seed: -1 });
		}
		return sw;
	};
	makeSwitch([0.75, 0.1, 0.32], P.l3, 12, (i) => (i < 6 ? 0 : 1));
	makeSwitch([0.55, 0.08, 0.26], P.l2a, 8, () => 0, 0);
	makeSwitch([0.55, 0.08, 0.26], P.l2b, 8, () => 1, 1);

	// PCs: monitors whose screens glow in their VLAN colour
	const screens: Array<{ mesh: Mesh; chart: number }> = [];
	const standMaterial = standard(0x9aa4b2, { metalness: 0.6, roughness: 0.4 });
	for (const [node, chart] of [["a1", 0], ["a2", 0], ["b1", 1], ["b2", 1]] as const) {
		const pc = new Group();
		pc.position.set(P[node].x + 0.1, 0, P[node].z);
		scene.add(pc);
		const monitor = new Mesh(new RoundedBoxGeometry(0.34, 0.21, 0.025, 2, 0.008), body);
		monitor.position.y = 0.2;
		pc.add(monitor);
		const screen = new Mesh(new PlaneGeometry(0.31, 0.18), new MeshBasicMaterial());
		screen.position.set(0, 0.2, 0.0135);
		pc.add(screen);
		screens.push({ mesh: screen, chart });
		const stand = new Mesh(new CylinderGeometry(0.012, 0.012, 0.1, 8), standMaterial);
		stand.position.y = 0.06;
		pc.add(stand);
		const base = new Mesh(new CylinderGeometry(0.07, 0.07, 0.01, 24), standMaterial);
		base.position.y = 0.005;
		pc.add(base);
	}

	// Windows Server tower
	const server = new Mesh(new RoundedBoxGeometry(0.26, 0.46, 0.38, 2, 0.015), body);
	server.position.set(0.15, 0.23, -0.95);
	scene.add(server);
	const serverFront = new Mesh(new PlaneGeometry(0.24, 0.44), new MeshBasicMaterial({ map: serverFace(), transparent: true }));
	serverFront.position.z = 0.191;
	server.add(serverFront);

	/* ---------- Packets ---------- */
	const packetGeometry = new SphereGeometry(0.038, 18, 12);
	const haloGeometry = new SphereGeometry(0.075, 18, 12);
	const packets = FLOWS.map((flow) => {
		const core = new Mesh(packetGeometry, new MeshBasicMaterial());
		const halo = new Mesh(haloGeometry, new MeshBasicMaterial({ transparent: true, opacity: 0.25, depthWrite: false }));
		core.add(halo);
		core.visible = false;
		scene.add(core);
		const hops = flow.route.slice(1).map((to, i) => {
			const from = flow.route[i];
			return { at: segment(from, to), length: P[from].distanceTo(P[to]) * 1.05, chart: flow.colors[i] };
		});
		const total = hops.reduce((sum, h) => sum + h.length, 0);
		return { flow, core, halo, hops, duration: total / SPEED, total };
	});

	/* ---------- Labels ---------- */
	ctx.label("Internet", v(-2.1, 0.9, 0));
	ctx.label("ACL", v(-1.42, 0.68, 0));
	ctx.label("Router", v(-0.75, 0.32, 0));
	ctx.label("L3 switch", v(0.15, 0.28, 0.1));
	ctx.label("Windows Server", v(0.15, 0.62, -0.95));
	ctx.label("VLAN 10", v(1.2, 0.26, -0.55), "max-sm:hidden");
	ctx.label("VLAN 20", v(1.2, 0.26, 0.55), "max-sm:hidden");

	/* ---------- Colour ---------- */
	let chart: Color[] = [];
	const shieldBase = new Color();
	const drop = new Color();
	const tint = new Color();
	let flashUntil = -1;

	const applyPalette = (p: Palette) => {
		chart = p.chart;
		cloudMaterial.color.set(p.dark ? 0xdfe6ee : 0xb9c5d3);
		benchMaterial.color.copy(p.card);
		gridMaterial.color.copy(p.border);
		gridMaterial.opacity = p.dark ? 0.6 : 0.9;
		shieldBase.copy(p.foreground);
		drop.copy(p.chart[3]);
		shieldEdge.color.copy(shieldBase);
		shieldFill.color.copy(shieldBase);
		for (const { mesh, chart: c } of screens) (mesh.material as MeshBasicMaterial).color.copy(p.chart[c]).multiplyScalar(p.dark ? 0.9 : 1);
		for (const { mesh, chart: c } of leds) (mesh.material as MeshBasicMaterial).color.copy(p.chart[c]);
	};
	applyPalette(ctx.palette);

	const placePackets = (t: number) => {
		const time = t % CYCLE;
		for (const p of packets) {
			let local = time - p.flow.start;
			if (local < 0) local += CYCLE;
			const extra = p.flow.blocked ? 0.45 : 0;
			if (local > p.duration + extra) {
				p.core.visible = false;
				continue;
			}
			p.core.visible = true;
			let distance = Math.min(local, p.duration) * SPEED;
			let hop = p.hops[0];
			for (const h of p.hops) {
				hop = h;
				if (distance <= h.length) break;
				distance -= h.length;
			}
			const u = Math.min(1, distance / hop.length);
			p.core.position.copy(hop.at(u));
			const color = chart[hop.chart];
			(p.core.material as MeshBasicMaterial).color.copy(color);
			(p.halo.material as MeshBasicMaterial).color.copy(color);
			if (p.flow.blocked && local > p.duration) {
				// Dropped at the shield: burst and fade.
				const k = (local - p.duration) / extra;
				p.core.scale.setScalar(1 + k * 2.5);
				(p.core.material as MeshBasicMaterial).transparent = true;
				(p.core.material as MeshBasicMaterial).opacity = 1 - k;
				(p.halo.material as MeshBasicMaterial).opacity = 0.25 * (1 - k);
				flashUntil = t + 0.35;
			} else {
				p.core.scale.setScalar(1);
				(p.core.material as MeshBasicMaterial).opacity = 1;
				(p.halo.material as MeshBasicMaterial).opacity = 0.25;
			}
		}
	};

	// Still frame (reduced motion): one packet of each kind mid-route.
	const still = () => {
		placePackets(0.9);
		packets[2].core.visible = true;
		packets[2].core.position.copy(segment("l3", "l2b")(0.5));
		(packets[2].core.material as MeshBasicMaterial).color.copy(chart[1]);
	};

	return {
		update(t, dt) {
			if (dt === 0) {
				still();
				return;
			}
			scene.rotation.y = Math.sin(t * 0.18) * 0.1;
			cloud.position.y = 0.55 + Math.sin(t * 1.2) * 0.02;
			placePackets(t);
			// Shield flashes red when it drops a packet.
			const flashing = t < flashUntil;
			tint.copy(shieldBase).lerp(drop, flashing ? 1 : 0);
			shieldEdge.color.copy(tint);
			shieldFill.color.copy(tint);
			shieldFill.opacity = flashing ? 0.35 : 0.16;
			for (const led of leds) {
				if (led.seed < 0) continue;
				led.mesh.visible = Math.sin(t * 6 + led.seed * 7) > -0.6;
			}
		},
		applyPalette,
	};
}

/** Four arrows (two in, two out), the standard router symbol, on a transparent canvas. */
function routerArrows() {
	const size = 256;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const c = canvas.getContext("2d")!;
	c.translate(size / 2, size / 2);
	c.strokeStyle = "#e7ecf2";
	c.fillStyle = "#e7ecf2";
	c.lineWidth = 12;
	c.lineCap = "round";
	for (let i = 0; i < 4; i++) {
		c.save();
		c.rotate((i * Math.PI) / 2 + Math.PI / 4);
		const outward = i % 2 === 0;
		const [from, to] = outward ? [22, 92] : [92, 22];
		c.beginPath();
		c.moveTo(0, from);
		c.lineTo(0, to);
		c.stroke();
		c.beginPath();
		const dir = outward ? 1 : -1;
		c.moveTo(-16, to - dir * 18);
		c.lineTo(0, to + dir * 4);
		c.lineTo(16, to - dir * 18);
		c.closePath();
		c.fill();
		c.restore();
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Server front: the Windows four-pane mark, drive bays, and a power LED. */
function serverFace() {
	const w = 240;
	const h = 440;
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const c = canvas.getContext("2d")!;
	const pane = 34;
	const gap = 6;
	const left = w / 2 - pane - gap / 2;
	c.fillStyle = "#1daef1";
	for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) c.fillRect(left + x * (pane + gap), 60 + y * (pane + gap), pane, pane);
	c.fillStyle = "#9aa7b8";
	c.font = '600 20px "Archivo Variable", sans-serif';
	c.textAlign = "center";
	c.fillText("Windows Server", w / 2, 190);
	c.fillStyle = "#2b3d54";
	for (let i = 0; i < 4; i++) c.fillRect(30, 230 + i * 42, w - 60, 28);
	c.fillStyle = "#34d399";
	c.beginPath();
	c.arc(w - 36, h - 36, 7, 0, Math.PI * 2);
	c.fill();
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}
