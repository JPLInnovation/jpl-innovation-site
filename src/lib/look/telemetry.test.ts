import { test } from "node:test";
import assert from "node:assert/strict";
import { telemetry } from "./telemetry.ts";

const pad = { x: 8, z: -232 };

test("altitude is the height, distance is to the far pad on the ground", () => {
	const t = telemetry(undefined, { x: 8, y: 12.34, z: -132, yaw: Math.PI, t: 0 }, pad);
	assert.equal(t.altitude, 12.3);
	assert.equal(t.toPad, 100);
});

test("heading: 0 flying toward -z (the far pad), 90 toward +x, 180 toward +z, 270 toward -x", () => {
	const at = (yaw: number) => telemetry(undefined, { x: 0, y: 0, z: 0, yaw, t: 0 }, pad).heading;
	assert.equal(at(Math.PI), 0);
	assert.equal(at(Math.PI / 2), 90);
	assert.equal(at(0), 180);
	assert.equal(at(-Math.PI / 2), 270);
});

test("speed is the distance flown since the last sample over the time it took", () => {
	const a = { x: 0, y: 5, z: 0, yaw: Math.PI, t: 1 };
	const b = { x: 3, y: 5, z: -4, yaw: Math.PI, t: 1.5 };
	assert.equal(telemetry(a, b, pad).speed, 10);
});

test("no time passed (or no last sample): speed 0, never NaN or Infinity", () => {
	const a = { x: 0, y: 5, z: 0, yaw: Math.PI, t: 1 };
	assert.equal(telemetry(a, { ...a, x: 2 }, pad).speed, 0);
	assert.equal(telemetry(undefined, a, pad).speed, 0);
});
