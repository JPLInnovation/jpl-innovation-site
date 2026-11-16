import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaRows, gridSlots, markWords, sceneAt } from "./frc-race.ts";

test("the pinned chapters: progress picks one scene, every scene gets a share, never out of range", () => {
	assert.equal(sceneAt(0, 8), 0);
	assert.equal(sceneAt(-1, 8), 0);
	assert.equal(sceneAt(1, 8), 7);
	assert.equal(sceneAt(2, 8), 7);
	assert.equal(sceneAt(0.13, 8), 1);
	const seen = new Set<number>();
	for (let p = 0; p <= 1; p += 0.001) seen.add(sceneAt(p, 8));
	assert.equal(seen.size, 8);
});

test("the starting grid: one slot per team, ours lit at its rank, the rest above or below", () => {
	const g = gridSlots(19, 44);
	assert.equal(g.length, 44);
	assert.deepEqual(g[18], { p: 19, kind: "us" });
	assert.equal(g.filter((s) => s.kind === "above").length, 18);
	assert.equal(g.filter((s) => s.kind === "below").length, 25);
	assert.equal(gridSlots(16, 40).filter((s) => s.kind === "us")[0].p, 16);
});

test("the statement's marks: the marked words come out as their own pieces, the text is unchanged", () => {
	const parts = markWords("Built in Vietnam. Raced on two continents.", ["two continents"]);
	assert.deepEqual(parts, [
		{ text: "Built in Vietnam. Raced on ", mark: false },
		{ text: "two continents", mark: true },
		{ text: ".", mark: false },
	]);
	assert.equal(parts.map((p) => p.text).join(""), "Built in Vietnam. Raced on two continents.");
	assert.deepEqual(markWords("No marks here.", ["absent"]), [{ text: "No marks here.", mark: false }]);
});

test("the calendar: last season done with its results, this season's current step marked, in order", () => {
	const rows = agendaRows(
		[
			{ when: "Jan 4, 2026", title: "Kickoff", desc: "a" },
			{ when: "Mar 4 – 7", title: "Canadian Pacific Regional", desc: "b" },
		],
		[
			{ when: "Sep – Dec 2026", title: "Preseason", desc: "c", state: "current" },
			{ when: "Jan 9, 2027", title: "Kickoff & game reveal", desc: "d", state: "upcoming" },
		],
		[{ name: "Canadian Pacific Regional", rank: 19, of: 44, alliance: 6 }],
	);
	assert.deepEqual(
		rows.map((r) => [r.title, r.state]),
		[
			["Kickoff", "done"],
			["Canadian Pacific Regional", "done"],
			["Preseason", "current"],
			["Kickoff & game reveal", "upcoming"],
		],
	);
	assert.deepEqual(rows[1].result, { rank: 19, of: 44, alliance: 6 });
	assert.equal(rows[0].result, undefined);
});
