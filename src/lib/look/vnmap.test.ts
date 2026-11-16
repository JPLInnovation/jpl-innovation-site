import { test } from "node:test";
import assert from "node:assert/strict";
import { FRAME, SIZE, pointsAlong, project, routeVia, simplify, smooth } from "./vnmap.ts";

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

test("the frame's corners land on the drawing's corners", () => {
	assert.deepEqual(project(FRAME.north, FRAME.west), [0, 0]);
	const [x, y] = project(FRAME.south, FRAME.east);
	assert.ok(near(x, SIZE.w) && near(y, SIZE.h), `${x},${y} vs ${SIZE.w},${SIZE.h}`);
});
test("north is up and east is right; Saigon is south-east of Hanoi", () => {
	const hanoi = project(21.03, 105.85);
	const saigon = project(10.78, 106.7);
	assert.ok(saigon[1] > hanoi[1], "Saigon lower on the sheet");
	assert.ok(saigon[0] > hanoi[0], "Saigon further right");
});
test("a degree of longitude is shorter than a degree of latitude at Vietnam's latitude", () => {
	const [x0, y0] = project(16, 105);
	const [x1] = project(16, 106);
	const [, y1] = project(15, 105);
	assert.ok(x1 - x0 < y1 - y0);
	assert.ok(x1 - x0 > 0.9 * (y1 - y0));
});

test("simplify keeps the ends and drops points that sit on the line", () => {
	const line: [number, number][] = [[0, 0], [1, 0.01], [2, 0], [3, -0.01], [4, 0]];
	assert.deepEqual(simplify(line, 0.1), [[0, 0], [4, 0]]);
});
test("simplify keeps a corner that sticks out more than the tolerance", () => {
	const line: [number, number][] = [[0, 0], [2.5, 1.52], [5, 3], [7.5, 1.48], [10, 0]];
	assert.deepEqual(simplify(line, 0.5), [[0, 0], [5, 3], [10, 0]]);
});
test("simplify leaves short lines alone", () => {
	assert.deepEqual(simplify([[0, 0], [1, 1]], 5), [[0, 0], [1, 1]]);
});

test("pointsAlong spaces stops evenly by distance, ends included", () => {
	const pts = pointsAlong([[0, 0], [10, 0], [10, 10]], 5);
	assert.equal(pts.length, 5);
	const expect = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]];
	pts.forEach((p, i) => assert.ok(near(p[0], expect[i][0]) && near(p[1], expect[i][1]), `${i}: ${p}`));
});
test("smooth passes through every point it was given, in order", () => {
	const pts: [number, number][] = [[0, 0], [10, 5], [20, 0], [30, 8]];
	const line = smooth(pts, 6);
	assert.equal(line.length, (pts.length - 1) * 6 + 1);
	pts.forEach((p, i) => assert.deepEqual(line[i * 6], p));
});
test("smooth of nothing is nothing (a person with one place has no route)", () => {
	assert.deepEqual(smooth([], 10), []);
});
test("smooth leaves two points as a straight line", () => {
	assert.deepEqual(smooth([[0, 0], [4, 0]], 2), [[0, 0], [2, 0], [4, 0]]);
});
test("routeVia keeps only the coast between the first place and the last", () => {
	const coast: [number, number][] = [[20, 107], [18, 107], [15, 109], [12, 110], [10.5, 108], [9, 106]];
	const route = routeVia([[19, 105], [16.7, 107], [10.8, 106.7]], coast);
	assert.deepEqual(route, [[19, 105], [18, 107], [15, 109], [12, 110], [10.5, 108], [10.8, 106.7]]);
});
test("routeVia needs two places", () => {
	assert.deepEqual(routeVia([[10.8, 106.7]], [[12, 110]]), []);
});
test("pointsAlong with one stop gives the start", () => {
	assert.deepEqual(pointsAlong([[3, 4], [9, 9]], 1), [[3, 4]]);
});
