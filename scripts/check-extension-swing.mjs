// Run: node scripts/check-extension-swing.mjs
import assert from "node:assert/strict";
import { extensionAngle, SWING } from "../src/lib/three/models/extension-swing.ts";

const at = (p) => extensionAngle(p);
assert.equal(at(0), SWING, "starts stowed");
assert.ok(Math.abs(at(1)) < 1e-9, "ends exactly open");
assert.equal(at(-1), SWING, "clamps below 0");
assert.ok(Math.abs(at(2)) < 1e-9, "clamps above 1");

// The curve has no jumps, whatever speed the visitor scrolls at.
for (let i = 1; i <= 1000; i++) assert.ok(Math.abs(at(i / 1000) - at((i - 1) / 1000)) < 1, `jump near ${i / 1000}`);

// Lifts through the tipping point (66.3 degrees), then falls faster and faster.
assert.ok(at(0.2) < 67, "the jolt clears the tipping point");
const step = (p) => at(p) - at(p + 0.05);
assert.ok(step(0.6) > step(0.4) && step(0.4) > step(0.25), "the fall accelerates");

// One small settle off the stop: above open, small, and it never goes past the stop.
const settle = Array.from({ length: 100 }, (_, i) => at(0.82 + (i / 100) * 0.18));
assert.ok(settle.every((a) => a >= 0 && a < 4), "stays small and never goes through the stop");

console.log("extension swing ok");
