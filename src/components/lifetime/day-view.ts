/**
 * What the Lifetime demo shows at a minute of the simulated day (src/lib/look/lifetime-day.ts), in the window's
 * language. Used twice: by LifetimeDay.astro to render the end of the day on the server (what reduced motion and no
 * script see), and by its script to update the window as the scroll runs the day.
 */
import {
	DAY,
	MACHINES,
	OUTAGES,
	awakeAt,
	awakeMinutes,
	ceiling,
	events,
	fleetAt,
	knownAwake,
	serverUp,
	stateAt,
	timeline,
	week,
	type Machine,
	type Status,
} from "@/lib/look/lifetime-day";
import { lifetimePage, lifetimeUi } from "@/text/projects/lifetime";

export type Lang = keyof typeof lifetimeUi;
export const GAUGE_TICKS = 31; // the product's FleetGauge
export const FULL_DAY = 24 * 60;

export const clock = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function duration(minutes: number, lang: Lang) {
	return fill(lifetimeUi[lang].duration, { hours: Math.floor(minutes / 60), minutes: String(Math.round(minutes) % 60).padStart(2, "0") });
}

export const beats = lifetimePage.demo.beats.map((b) => ({ ...b, at: minutesOf(b.from) }));
export const beatAt = (t: number) => beats.reduce((found, b, i) => (b.at <= t ? i : found), 0);
const outage = OUTAGES[0];

/** The week's bars are scaled to the week's final largest day, so the axis stays still while today grows. */
export const weekEnd = week(DAY.end);
export const top = ceiling(weekEnd);

/** Everything that changes with the minute. */
export function view(t: number) {
	const f = fleetAt(t);
	const known = MACHINES.map((m) => knownAwake(m, t));
	const queued = MACHINES.reduce((n, m, i) => n + Math.max(0, awakeMinutes(m, t + 1) - known[i]), 0);
	const enrolled = f.total - f.pending;
	return {
		t,
		fleet: f,
		enrolled,
		known,
		states: MACHINES.map((m) => stateAt(m, f.updated)),
		awake: MACHINES.map((m) => awakeAt(m, t)),
		present: MACHINES.map((m) => (m.joins ?? -Infinity) <= t),
		awakeToday: known.reduce((a, b) => a + b, 0),
		reporting: known.filter((k) => k > 0).length,
		lit: enrolled ? Math.round((f.online / enrolled) * GAUGE_TICKS) : 0,
		today: week(t)[6] ?? 0,
		/** awake minutes the computers counted and the server has not received yet (only after the outage begins) */
		queued: t >= outage.start ? queued : 0,
		live: serverUp(t),
		beat: beatAt(t),
		recent: events()
			.filter((e) => e.at <= f.updated)
			.slice(-5)
			.reverse(),
	};
}
export type View = ReturnType<typeof view>;

/** The status chip's glyph (the product's 20-unit monoline glyphs): good check, warning bang, neutral dash, info. */
const GLYPH: Record<string, string> = {
	online: '<path d="M4 10.5 8.5 15 16 5"/>',
	offline: '<path d="M10 3v9"/><path d="M10 17h.01"/>',
	noreport: '<path d="M4 10h12"/>',
	pending: '<path d="M10 3.5h.01"/><path d="M10 8v9"/>',
};
export const chipGlyph = (state: string) =>
	`<svg class="lt-glyph" viewBox="0 0 20 20" aria-hidden="true">${GLYPH[state] ?? GLYPH.noreport}</svg>`;

export const STATUSES: Status[] = ["online", "offline", "noreport", "pending"];

/** A computer's 24-hour timeline: the server's record as segments, and a cover over what hasn't happened yet. */
export function timelineHtml(m: Machine) {
	const segs = timeline(m)
		.filter((s) => s.state !== "none" && s.state !== "pending" && s.state !== "noreport")
		.map((s) => `<i class="lt-seg is-${s.state}" style="left:${((s.start / FULL_DAY) * 100).toFixed(3)}%;width:${(((s.end - s.start) / FULL_DAY) * 100).toFixed(3)}%"></i>`)
		.join("");
	return `<span class="lt-tl" aria-hidden="true">${segs}<i class="lt-tl-cover" data-cover style="transform:scaleX(var(--cover, 0))"></i></span>`;
}

/** How far the server's record has reached at `t` (its cover's scale: the share of the day still to come). */
export const coverScale = (v: View) => 1 - (v.fleet.updated + 1) / FULL_DAY;

/** A row's changing values: its status chip and its awake time as the server has it. */
export function rowValues(index: number, v: View, lang: Lang) {
	const ui = lifetimeUi[lang];
	const state = v.states[index] as Status | null;
	const words = state ? ui.rowStatus[state] : "";
	return {
		state: state ?? "noreport",
		chip: chipHtml(state ?? "noreport", words),
		awake: v.known[index] > 0 ? duration(v.known[index], lang) : ui.notAvailable,
	};
}

/** One row of the device list. */
export function rowHtml(index: number, v: View, lang: Lang, selected: boolean) {
	const m = MACHINES[index];
	const ui = lifetimeUi[lang];
	const values = rowValues(index, v, lang);
	return `<li class="lt-row${selected ? " is-selected" : ""}" data-row="${index}"><button type="button" class="lt-row-btn" data-pick="${index}" aria-pressed="${selected}"><span class="lt-cell lt-name">${esc(m.name)}</span><span class="lt-cell lt-group">${esc(ui.groups[m.group])}</span><span class="lt-cell lt-state" data-chip data-state="${values.state}">${values.chip}</span><span class="lt-cell lt-awake" data-awake>${esc(values.awake)}</span><span class="lt-cell lt-when">${timelineHtml(m)}</span></button></li>`;
}

/** The computer picked at first: one that was busy while the server was down and asleep when it came back. */
export const defaultPick = Math.max(
	0,
	MACHINES.findIndex((m) => m.group === "lab" && m.awake.some((s) => s.start < OUTAGES[0].end && s.end > OUTAGES[0].start + 30) && !awakeAt(m, OUTAGES[0].end)),
);

/** The device list's rows on this page: the computers in the fleet at the shown minute, by name, optionally one state. */
export function listed(v: View, filter: Status | null) {
	return MACHINES.map((_, i) => i)
		.filter((i) => v.states[i] !== null && (filter === null || v.states[i] === filter))
		.sort((a, b) => MACHINES[a].name.localeCompare(MACHINES[b].name));
}

export const chipHtml = (state: string, words: string) => `<span class="lt-chip is-${state}">${chipGlyph(state)}<span>${esc(words)}</span></span>`;

export function eventsHtml(v: View, lang: Lang) {
	const ui = lifetimeUi[lang];
	return v.recent
		.map(
			(e) => `<li><span class="lt-ev-name">${esc(e.name)}</span><span class="lt-ev-kind"><i class="lt-dot is-${
				e.kind === "synchronized" ? "online" : e.kind === "offline" ? "offline" : "pending"
			}"></i>${esc(ui.eventKinds[e.kind])}</span><span class="lt-ev-at">${clock(e.at)}</span></li>`,
		)
		.join("");
}

/** The two strips under the plan for the picked computer, across the scrolled day (06:00 to 18:00). */
export function compareHtml(m: Machine) {
	const span = DAY.end - DAY.start;
	const pos = (a: number, b: number) =>
		`left:${(((Math.max(a, DAY.start) - DAY.start) / span) * 100).toFixed(3)}%;width:${(((Math.min(b, DAY.end) - Math.max(a, DAY.start)) / span) * 100).toFixed(3)}%`;
	const own = m.awake
		.filter((s) => s.end > DAY.start && s.start < DAY.end)
		.map((s) => `<i class="lt-seg is-awake" style="${pos(s.start, s.end)}"></i>`)
		.join("");
	const seen = timeline(m)
		.filter((s) => (s.state === "online" || s.state === "unknown") && s.end > DAY.start && s.start < DAY.end)
		.map((s) => `<i class="lt-seg is-${s.state}" style="${pos(s.start, s.end)}"></i>`)
		.join("");
	return { own, seen };
}
