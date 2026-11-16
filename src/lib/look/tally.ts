/**
 * The receipt's arithmetic (pure, tested in tally.test.ts): each group's subtotal is the sum of its priced rows, the
 * total the sum of the subtotals, and each group's share of the total in whole percents that add up to exactly 100
 * (largest remainder). Rows without a price count as parts but add nothing.
 */
export interface Row {
	price?: number;
}

export function tally<G extends { parts: Row[] }>(groups: G[]) {
	const sums = groups.map((g) => ({
		...g,
		subtotal: g.parts.reduce((s, p) => s + (p.price ?? 0), 0),
		count: g.parts.length,
		unpriced: g.parts.filter((p) => p.price === undefined).length,
	}));
	const total = sums.reduce((s, g) => s + g.subtotal, 0);
	const exact = sums.map((g) => (total ? (g.subtotal / total) * 100 : 0));
	const share = exact.map(Math.floor);
	let left = total ? 100 - share.reduce((s, x) => s + x, 0) : 0;
	// the leftover points go to the largest remainders, the earlier group first on a tie
	for (const i of exact.map((x, i) => i).sort((a, b) => exact[b] - share[b] - (exact[a] - share[a]) || a - b)) {
		if (left-- <= 0) break;
		share[i]++;
	}
	return {
		groups: sums.map((g, i) => ({ ...g, share: share[i] })),
		total,
		count: sums.reduce((s, g) => s + g.count, 0),
		priced: groups.some((g) => g.parts.some((p) => p.price !== undefined)),
	};
}
