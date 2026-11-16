import { test } from "node:test";
import assert from "node:assert/strict";
import {
	DAY,
	MACHINES,
	OUTAGES,
	awakeAt,
	awakeHours,
	awakeMinutes,
	ceiling,
	events,
	fleetAt,
	knownAwake,
	seenAt,
	serverUp,
	stateAt,
	timeline,
	unknownSpans,
	week,
} from "./lifetime-day.ts";

const minutes = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
const byName = (name: string) => MACHINES.find((m) => m.name === name)!;
const joined = (t: number) => MACHINES.filter((m) => (m.joins ?? -Infinity) <= t);
const outage = OUTAGES[0];

test("each machine's awake record is sorted and never overlaps itself", () => {
	for (const m of MACHINES) {
		for (let i = 1; i < m.awake.length; i++) assert.ok(m.awake[i].start > m.awake[i - 1].end, m.name);
		for (const s of m.awake) assert.ok(s.start < s.end, m.name);
	}
});

test("the room: 21 computers before the new one joins, 22 after", () => {
	assert.equal(fleetAt(DAY.start).total, 21);
	assert.equal(fleetAt(DAY.end).total, 22);
});

test("Online, Offline, No report yet and Pending approval always add up to the room", () => {
	for (const t of minutes(DAY.start, DAY.end + 1)) {
		const f = fleetAt(t);
		assert.equal(f.online + f.offline + f.noreport + f.pending, f.total, `at ${t}`);
		assert.equal(f.total, joined(f.updated).length, `at ${t}`);
	}
});

test("before school every computer is asleep, so the server lists them all as Offline", () => {
	const f = fleetAt(DAY.start);
	assert.deepEqual([f.online, f.offline, f.noreport, f.pending], [0, 21, 0, 0]);
});

test("the morning lesson wakes the lab", () => {
	assert.ok(fleetAt(8 * 60).online >= 15);
});

test("the server goes down mid-day: that stretch is Unknown for every computer, and only that stretch", () => {
	assert.ok(outage.start >= 10 * 60 && outage.end <= 14 * 60);
	for (const m of MACHINES)
		for (const t of minutes(DAY.start, DAY.end)) {
			const s = stateAt(m, t);
			if (s === null) continue;
			assert.equal(s === "unknown", !serverUp(t), `${m.name} at ${t}`);
		}
	assert.deepEqual(unknownSpans(DAY.end), OUTAGES);
	assert.deepEqual(unknownSpans(outage.start), []);
	assert.deepEqual(unknownSpans(outage.start + 30), [{ start: outage.start, end: outage.start + 30 }]);
});

test("while the server is down the dashboard is frozen at the last minute it heard anything", () => {
	const last = fleetAt(outage.start - 1);
	for (const t of minutes(outage.start, outage.end)) {
		const f = fleetAt(t);
		assert.equal(f.live, false);
		assert.equal(f.updated, outage.start - 1);
		assert.deepEqual({ ...f, live: true }, { ...last, live: true });
		assert.equal(seenAt(t), outage.start - 1);
	}
	assert.equal(fleetAt(outage.end).live, true);
});

test("each machine's awake hours are exactly its awake record", () => {
	for (const m of MACHINES) {
		const total = m.awake.reduce((sum, s) => sum + s.end - s.start, 0);
		assert.equal(awakeMinutes(m, 24 * 60), total, m.name);
		assert.equal(awakeHours(m, 24 * 60), total / 60, m.name);
		let counted = 0;
		for (const t of minutes(0, DAY.end)) counted += awakeAt(m, t) ? 1 : 0;
		assert.equal(awakeMinutes(m, DAY.end), counted, m.name);
	}
});

test("the timeline accounts for every minute, and Unknown is never counted as online or offline", () => {
	for (const m of MACHINES) {
		const segs = timeline(m);
		for (let i = 1; i < segs.length; i++) assert.equal(segs[i].start, segs[i - 1].end, m.name);
		assert.equal(segs.at(-1)!.end, 24 * 60);
		const sum = (state: string) => segs.filter((s) => s.state === state).reduce((n, s) => n + s.end - s.start, 0);
		assert.equal(sum("unknown"), outage.end - outage.start, m.name);
		for (const s of segs)
			if (s.state === "online" || s.state === "offline")
				assert.ok(s.end <= outage.start || s.start >= outage.end, `${m.name}: ${s.state} inside the outage`);
		// online on the timeline = awake while the server was up (once it reports), so the hours match the timeline
		const awakeWhileSeen = minutes(0, 24 * 60).filter((t) => awakeAt(m, t) && serverUp(t) && stateAt(m, t) === "online").length;
		assert.equal(sum("online"), awakeWhileSeen, m.name);
		const awakeInUnknown = minutes(outage.start, outage.end).filter((t) => awakeAt(m, t)).length;
		const beforeReporting = minutes(0, 24 * 60).filter((t) => awakeAt(m, t) && ["pending", "noreport", null].includes(stateAt(m, t))).length;
		assert.equal(awakeMinutes(m, 24 * 60), sum("online") + awakeInUnknown + beforeReporting, m.name);
	}
});

test("the computers keep counting while the server is down, and send it later", () => {
	const busy = MACHINES.filter((m) => m.awake.some((s) => s.start < outage.end && s.end > outage.start + 30));
	assert.ok(busy.length >= 10, `${busy.length} computers awake in the outage`);
	for (const m of busy) {
		assert.ok(awakeMinutes(m, outage.end) > awakeMinutes(m, outage.start), m.name);
		assert.equal(knownAwake(m, outage.end - 1), knownAwake(m, outage.start - 1), `${m.name}: nothing arrives while it is down`);
	}
	const queued = (t: number) => MACHINES.reduce((n, m) => n + awakeMinutes(m, t) - knownAwake(m, t), 0);
	assert.ok(queued(outage.end - 1) > 6 * 60, `queued ${queued(outage.end - 1)} min`);
	for (const m of MACHINES) assert.equal(knownAwake(m, DAY.end), awakeMinutes(m, DAY.end), `${m.name} caught up by the end`);
	// a computer awake when the server returns sends at once; one asleep sends when it next wakes
	const awakeAtReturn = busy.find((m) => awakeAt(m, outage.end));
	assert.ok(awakeAtReturn);
	assert.equal(knownAwake(awakeAtReturn!, outage.end), awakeMinutes(awakeAtReturn!, outage.end + 1)); // up to this minute
	const asleepAtReturn = busy.find((m) => !awakeAt(m, outage.end));
	assert.ok(asleepAtReturn);
	assert.ok(knownAwake(asleepAtReturn!, outage.end) < awakeMinutes(asleepAtReturn!, outage.end));
});

test("what the server knows never runs ahead of the computer, and never goes down", () => {
	for (const m of MACHINES) {
		let before = 0;
		for (const t of minutes(DAY.start, DAY.end + 1)) {
			const k = knownAwake(m, t);
			assert.ok(k <= awakeMinutes(m, t + 1), `${m.name} at ${t}`);
			assert.ok(k >= before, `${m.name} at ${t}`);
			before = k;
		}
	}
});

test("the new computer: Pending approval, then No report yet, then online", () => {
	const fresh = MACHINES.find((m) => m.joins !== undefined)!;
	assert.equal(stateAt(fresh, fresh.joins! - 1), null);
	assert.equal(stateAt(fresh, fresh.joins!), "pending");
	assert.ok(fresh.approved! >= outage.end, "approved once the server is back");
	assert.equal(stateAt(fresh, fresh.approved!), "noreport");
	assert.equal(stateAt(fresh, 14 * 60), "online");
	assert.equal(fleetAt(10 * 60).pending, 1);
	assert.equal(fleetAt(fresh.approved!).noreport, 1);
	assert.equal(knownAwake(fresh, fresh.approved!), 0);
});

test("the teacher's computer is awake when the server returns", () => {
	assert.ok(awakeAt(byName("TEACHER-PC"), outage.end));
});

test("the week: two weekend days with no record, four full days, and today counting up", () => {
	const end = week(DAY.end);
	assert.equal(end.length, 7);
	assert.equal(end[0], null);
	assert.equal(end[1], null);
	for (const v of end.slice(2)) assert.ok(v !== null && v > 50 && v < 22 * 12, String(v));
	const today = MACHINES.reduce((n, m) => n + knownAwake(m, DAY.end), 0) / 60;
	assert.equal(end[6], today);
	let before = -1;
	for (const t of minutes(DAY.start, DAY.end + 1)) {
		const v = week(t)[6]!;
		assert.ok(v >= before, `at ${t}`);
		before = v;
		assert.deepEqual(week(t).slice(0, 6), end.slice(0, 6));
	}
	assert.equal(week(DAY.start)[6], 0);
});

test("the chart's ceiling is the product's: a round number at or above the largest day", () => {
	assert.equal(ceiling([42, 95, null]), 100);
	assert.equal(ceiling([158]), 200);
	assert.equal(ceiling([7.5]), 8);
	assert.equal(ceiling([]), 1);
});

test("events happen only while the server is up, in order", () => {
	const all = events();
	assert.ok(all.length > 20);
	for (let i = 1; i < all.length; i++) assert.ok(all[i].at >= all[i - 1].at);
	for (const e of all) assert.ok(serverUp(e.at), `${e.name} ${e.kind} at ${e.at}`);
	assert.ok(all.some((e) => e.kind === "awaiting"));
	assert.ok(all.some((e) => e.kind === "synchronized" && e.at === outage.end));
});
