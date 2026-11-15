/**
 * The FRC page's race-weekend devices, the parts that are pure logic (src/components/frc/*, src/components/frc-photos.tsx).
 */

/** The pinned rookie-season chapters: which of `n` scenes shows at scroll progress `p` (0 to 1). */
export const sceneAt = (p: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(p * n * 0.9999)));

/** The starting grid: one slot per team in qualification order, ours lit. */
export const gridSlots = (rank: number, of: number) =>
	Array.from({ length: of }, (_, i) => ({ p: i + 1, kind: i + 1 === rank ? "us" : i + 1 < rank ? "above" : "below" }) as const);

/** Splits `text` so each of `marks` (exact words of it) is a piece of its own; joined, the pieces are `text` again. */
export function markWords(text: string, marks: readonly string[]) {
	const found = marks.filter((m) => m && text.includes(m));
	if (!found.length) return [{ text, mark: false }];
	const re = new RegExp(`(${found.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
	return text
		.split(re)
		.filter(Boolean)
		.map((t) => ({ text: t, mark: found.includes(t) }));
}

type Step = { when: string; title: string; desc: string; state?: string };
type Result = { name: string; rank: number; of: number; alliance: number };

/** The calendar the KitBot drives down: last season's steps (done, with each regional's result), then this season's. */
export function agendaRows(past: readonly Step[], next: readonly Step[], results: readonly Result[]) {
	return [
		...past.map((s) => {
			const r = results.find((c) => c.name === s.title);
			return { ...s, state: "done" as const, result: r ? { rank: r.rank, of: r.of, alliance: r.alliance } : undefined };
		}),
		...next.map((s) => ({ ...s, state: s.state === "current" ? ("current" as const) : ("upcoming" as const), result: undefined })),
	];
}
