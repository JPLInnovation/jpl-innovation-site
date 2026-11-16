/**
 * One simulated school day in a computer lab, as Lifetime Server sees it (the live demo on /work/lifetime/,
 * src/components/lifetime/LifetimeDay.astro). Made up, and captioned as a simulation on the page: no customer's data.
 *
 * The rules are the product's (src/text/projects/lifetime.md): each computer counts its own awake time from inside
 * the machine; when the server is down, each keeps counting and sends what it counted the next time it is awake with
 * the server up; time when the server was off is Unknown, never counted as online or offline; a new computer joins with
 * a one-time code and waits for an admin's approval, then shows No report yet until it first reports.
 *
 * Time is in minutes since 00:00 of the day; spans are half-open [start, end).
 */

export type Span = { start: number; end: number };
/** What the server records for a computer at a minute. */
export type Status = "online" | "offline" | "noreport" | "pending";
export type State = Status | "unknown";
export interface Machine {
	name: string;
	group: "lab" | "teacher";
	/** The computer's own record: when it was awake, sorted, never overlapping. */
	awake: Span[];
	/** When it joined the fleet with a one-time code (absent: enrolled before today, reporting since). */
	joins?: number;
	/** When an admin approved it. */
	approved?: number;
}

/** The part of the day the demo scrolls through: 06:00 to 18:00. */
export const DAY = { start: 6 * 60, end: 18 * 60 };
/** The server is down from 10:30 to 12:30. */
export const OUTAGES: Span[] = [{ start: 10 * 60 + 30, end: 12 * 60 + 30 }];
const FULL_DAY = 24 * 60;

/** The lab's timetable: lessons and how many of the 20 lab computers each one uses. */
const LESSONS = [
	{ start: 7 * 60, end: 8 * 60 + 30, seats: 16 },
	{ start: 8 * 60 + 45, end: 10 * 60 + 15, seats: 20 },
	{ start: 10 * 60 + 30, end: 11 * 60 + 45, seats: 12 },
	{ start: 12 * 60, end: 12 * 60 + 45, seats: 4 }, // a few students finish their work over lunch
	{ start: 13 * 60 + 15, end: 14 * 60 + 45, seats: 18 },
	{ start: 15 * 60, end: 16 * 60 + 30, seats: 20 },
	{ start: 16 * 60 + 40, end: 17 * 60 + 20, seats: 6 }, // an after-school club
];

/** A small deterministic hash, so the day is the same on every visit. */
function hash(...values: number[]) {
	let x = 2166136261;
	for (const v of values) {
		x ^= v;
		x = Math.imul(x, 16777619);
		x ^= x >>> 13;
	}
	return x >>> 0;
}

function merge(spans: Span[]): Span[] {
	const sorted = [...spans].sort((a, b) => a.start - b.start);
	const out: Span[] = [];
	for (const s of sorted) {
		const last = out.at(-1);
		if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
		else out.push({ ...s });
	}
	return out;
}

/** The lab on day `day` of the week (0 Monday … 4 Friday, today); earlier days use a few fewer seats. */
function school(day: number): Machine[] {
	const lab: Machine[] = Array.from({ length: 20 }, (_, i) => {
		const spans: Span[] = [];
		LESSONS.forEach((lesson, l) => {
			const seats = lesson.seats - (day === 4 ? 0 : (day * 7 + l * 3) % 5);
			// the seats a lesson uses: the first `seats` computers in a per-lesson shuffle
			const rank = Array.from({ length: 20 }, (_, j) => j).sort((a, b) => hash(a, l, day) - hash(b, l, day)).indexOf(i);
			if (rank >= seats) return;
			spans.push({ start: lesson.start - 8 + (hash(i, l, day, 1) % 10), end: lesson.end + 8 + (hash(i, l, day, 2) % 14) });
		});
		return { name: `LAB-${String(i + 1).padStart(2, "0")}`, group: "lab", awake: merge(spans) };
	});
	const teacher: Machine = {
		name: "TEACHER-PC",
		group: "teacher",
		awake: [
			{ start: 6 * 60 + 50, end: 11 * 60 + 52 },
			{ start: 12 * 60 + 8, end: 17 * 60 + 30 },
		],
	};
	return [...lab, teacher];
}

/** Today: the lab, the teacher's computer, and a new computer set up on the last desk at 09:20. */
export const MACHINES: Machine[] = [
	...school(4),
	{
		name: "LAB-21",
		group: "lab",
		joins: 9 * 60 + 20,
		approved: 12 * 60 + 40,
		awake: merge([
			{ start: 9 * 60 + 8, end: 9 * 60 + 35 }, // being installed
			{ start: LESSONS[4].start - 3, end: LESSONS[4].end + 12 },
			{ start: LESSONS[5].start - 5, end: LESSONS[5].end + 10 },
		]),
	},
];

const overlap = (a: Span, from: number, to: number) => Math.max(0, Math.min(a.end, to) - Math.max(a.start, from));

export const awakeAt = (m: Machine, t: number) => m.awake.some((s) => s.start <= t && t < s.end);
export const serverUp = (t: number) => !OUTAGES.some((o) => o.start <= t && t < o.end);

/** The minute the dashboard shows at `t`: `t` itself, or, while the server is down, the last minute before it went. */
export function seenAt(t: number) {
	const down = OUTAGES.find((o) => o.start <= t && t < o.end);
	return down ? down.start - 1 : t;
}

/** Awake minutes the computer counted from 00:00 until `until`. */
export const awakeMinutes = (m: Machine, until: number) => m.awake.reduce((n, s) => n + overlap(s, 0, until), 0);
export const awakeHours = (m: Machine, until: number) => awakeMinutes(m, until) / 60;

/** The first minute an approved new computer is awake with the server up: its first report. */
const firsts = new WeakMap<Machine, number>();
function firstReport(m: Machine) {
	if (m.approved === undefined) return -Infinity;
	let first = firsts.get(m);
	if (first === undefined) {
		first = Infinity;
		for (let t = m.approved; t < FULL_DAY; t++)
			if (awakeAt(m, t) && serverUp(t)) {
				first = t;
				break;
			}
		firsts.set(m, first);
	}
	return first;
}

/** What the server records for computer `m` at minute `t` (null: not in the fleet yet). */
export function stateAt(m: Machine, t: number): State | null {
	if (m.joins !== undefined && t < m.joins) return null;
	if (!serverUp(t)) return "unknown";
	if (m.approved !== undefined && t < m.approved) return "pending";
	if (t < firstReport(m)) return "noreport";
	return awakeAt(m, t) ? "online" : "offline";
}

export interface Fleet {
	online: number;
	offline: number;
	noreport: number;
	pending: number;
	total: number;
	/** false while the server is down: the counts are the last ones it had. */
	live: boolean;
	/** The minute these counts are from. */
	updated: number;
}

/** The dashboard's counts at minute `t`. Every computer in the fleet is in exactly one of the four. */
export function fleetAt(t: number): Fleet {
	const at = seenAt(t);
	const f: Fleet = { online: 0, offline: 0, noreport: 0, pending: 0, total: 0, live: serverUp(t), updated: at };
	for (const m of MACHINES) {
		const s = stateAt(m, at);
		if (s === null || s === "unknown") continue;
		f[s]++;
		f.total++;
	}
	return f;
}

/** Where the computer's record has reached the server by `t`: the last moment it was awake, approved and heard. */
function lastContact(m: Machine, t: number) {
	let last = -Infinity;
	const from = Math.max(m.approved ?? -Infinity, firstReport(m));
	for (const s of m.awake) {
		const start = Math.max(s.start, from);
		if (start > t) continue;
		// within this span, the latest minute ≤ t when the server was up
		for (let x = Math.min(s.end - 1, t); x >= start; x--)
			if (serverUp(x)) {
				last = Math.max(last, x + 1);
				break;
			}
	}
	return last;
}

/** Awake minutes the server has received from computer `m` by minute `t` (each computer sends what it counted). */
export function knownAwake(m: Machine, t: number) {
	const last = lastContact(m, t);
	return last === -Infinity ? 0 : awakeMinutes(m, last);
}

/** The stretches the server was off, up to `until`: shown as Unknown. */
export const unknownSpans = (until: number): Span[] =>
	OUTAGES.filter((o) => o.start < until).map((o) => ({ start: o.start, end: Math.min(o.end, until) }));

export type Segment = Span & { state: State | "none" };

/** The server's record of computer `m` across the whole day (00:00 to 24:00), as merged segments. */
export function timeline(m: Machine): Segment[] {
	const out: Segment[] = [];
	for (let t = 0; t < FULL_DAY; t++) {
		const state = stateAt(m, t) ?? "none";
		const last = out.at(-1);
		if (last && last.state === state) last.end = t + 1;
		else out.push({ start: t, end: t + 1, state });
	}
	return out;
}

export interface FleetEvent {
	at: number;
	name: string;
	kind: "synchronized" | "offline" | "awaiting";
}

let eventCache: FleetEvent[] | undefined;
/** The server's event log for the day: a report received, a computer gone quiet, a new one waiting for approval. */
export function events(): FleetEvent[] {
	if (eventCache) return eventCache;
	const out: FleetEvent[] = [];
	for (const m of MACHINES) {
		let before: State | null = null;
		let back = false;
		for (let t = 0; t < FULL_DAY; t++) {
			const s = stateAt(m, t);
			if (s === "unknown") {
				back = true; // the server hears nothing; when it is back, the first report (or the silence) is news
				continue;
			}
			if (s !== before || back) {
				back = false;
				if (s === "online") out.push({ at: t, name: m.name, kind: "synchronized" });
				else if (s === "offline" && before === "online") out.push({ at: t, name: m.name, kind: "offline" });
				else if (s === "pending") out.push({ at: t, name: m.name, kind: "awaiting" });
			}
			before = s;
		}
	}
	eventCache = out.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
	return eventCache;
}

const weekTotals = [0, 1, 2, 3].map((d) => school(d).reduce((n, m) => n + awakeMinutes(m, FULL_DAY), 0) / 60);

/**
 * Daily awake hours for the last 7 days, Saturday to today (Friday), as the server's chart shows them: the weekend
 * has no record (null, drawn as a dash, never as zero), and today is what has arrived by minute `t`.
 */
export function week(t: number): Array<number | null> {
	const today = MACHINES.reduce((n, m) => n + knownAwake(m, t), 0) / 60;
	return [null, null, ...weekTotals, today];
}

/** The chart's top line, as the product draws it: the largest value rounded up at its own magnitude. */
export function ceiling(values: Array<number | null>) {
	const known = values.filter((v): v is number => v !== null);
	const max = Math.max(1, ...known);
	const magnitude = 10 ** Math.floor(Math.log10(max));
	return Math.ceil(max / magnitude) * magnitude;
}
