import { test } from "node:test";
import assert from "node:assert/strict";
import { DRIVE, HUB, aimAt, ballsAt, fieldTransform, poseAt, shotPoint, toRobot } from "./kitbot-drive.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("before the drive the robot stands at its start; after it, its back is to its HUB (the launcher throws over the back)", () => {
	const start = poseAt(0);
	near(start.x, DRIVE.from.x);
	near(start.z, DRIVE.from.z);
	near(start.heading, DRIVE.from.heading);
	near(start.travelled, 0);
	const shot = poseAt(DRIVE.drive[1]);
	near(shot.x, DRIVE.to.x);
	near(shot.z, DRIVE.to.z);
	near(shot.heading, aimAt(DRIVE.to));
	// The KitBot's hood throws FUEL up and back, toward its own -z (frc-robot.ts, feedPath's end), so the HUB's centre
	// is straight behind it in the robot's own space.
	const hub = toRobot(shot, HUB.x, 0);
	near(hub.x, 0, 1e-9);
	assert.ok(hub.z < -1.5, `the HUB is behind it (${hub.z} m)`);
});

test("the drive is a function of the scroll: forward and back give the same pose, and it only ever moves forward along the path", () => {
	let last = -1;
	for (let s = 0; s <= 3; s += 0.01) {
		const p = poseAt(s);
		assert.ok(p.travelled >= last - 1e-9, `travelled never goes back at s=${s}`);
		last = p.travelled;
		assert.deepEqual(poseAt(s), p);
	}
	assert.ok(poseAt(3).travelled > 1.2, "a short path, but a real one (over a metre)");
	assert.ok(poseAt(3).travelled < 4, "and short (under 4 m)");
});

test("after the shot it turns in place for its close-ups, then stays put", () => {
	const shot = poseAt(DRIVE.drive[1]);
	const turned = poseAt(DRIVE.turn[1]);
	near(turned.x, shot.x);
	near(turned.z, shot.z);
	near(turned.heading, shot.heading + DRIVE.turnBy);
	assert.deepEqual(poseAt(13), turned);
});

test("the field's transform puts the robot at the origin, facing +z", () => {
	for (const s of [0, 0.4, 1, 1.7, 5]) {
		const p = poseAt(s);
		const t = fieldTransform(p);
		const c = Math.cos(t.rotationY);
		const n = Math.sin(t.rotationY);
		// three.js: world = Ry(rotationY) · local + position
		const x = p.x * c + p.z * n + t.x;
		const z = -p.x * n + p.z * c + t.z;
		near(x, 0);
		near(z, 0);
		const fx = Math.sin(p.heading);
		const fz = Math.cos(p.heading);
		near(fx * c + fz * n, 0);
		near(-fx * n + fz * c, 1);
	}
});

test("the shot: a stream of FUEL from the launcher into the HUB, only around the stakes", () => {
	assert.equal(ballsAt(0).filter((b) => b.visible).length, 0, "nothing in the air before the shot");
	assert.equal(ballsAt(3).filter((b) => b.visible).length, 0, "nor after it");
	const mid = ballsAt(1).filter((b) => b.visible);
	assert.ok(mid.length >= 3, `a stream in the air on the stakes (${mid.length})`);
	const from = shotPoint(0);
	const to = shotPoint(1);
	near(to[0], HUB.x);
	near(to[2], 0);
	assert.ok(to[1] > HUB.top, "it drops in from above the opening");
	assert.ok(Math.max(...[0.25, 0.5, 0.75].map((u) => shotPoint(u)[1])) > HUB.top + 0.4, "an arc, not a line");
	assert.ok(from[1] > 0.4 && from[1] < 0.7, "it leaves from the hood");
	// and it flies away from the robot's front, over its back
	const shot = poseAt(DRIVE.drive[1]);
	const a = toRobot(shot, from[0], from[2]);
	const b = toRobot(shot, shotPoint(0.2)[0], shotPoint(0.2)[2]);
	assert.ok(b.z < a.z, `the ball heads toward the robot's -z (${a.z.toFixed(2)} -> ${b.z.toFixed(2)})`);
});
