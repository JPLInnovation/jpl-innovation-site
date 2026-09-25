import { getCollection } from "astro:content";

/** Projects in their chosen order (the `order` field), then by title. */
export async function getProjects() {
	return (await getCollection("work")).sort(
		(a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
	);
}

export async function getMembers() {
	return (await getCollection("members")).sort((a, b) => a.data.title.localeCompare(b.data.title));
}

/** The fields the 3D member badges need (src/lib/three/models/badges.ts), as plain JSON for an island. */
export function toBadge(member: Awaited<ReturnType<typeof getMembers>>[number]) {
	const { data, id } = member;
	return {
		id,
		name: data.title,
		/** Short leadership line for the badge front, e.g. "CEO · Mechanical Lead (FRC)". */
		title: [data.leadership?.jpl, data.leadership?.frc && `${data.leadership.frc} (FRC)`].filter(Boolean).join(" · ") || undefined,
		roles: data.tags,
		img: data.img,
		skills: data.technical_skills.map((s) => ({ title: s.title, level: s.level })),
	};
}

type Member = Awaited<ReturnType<typeof getMembers>>[number];
export const ORG = { jpl: "JPL Innovation", frc: "FRC Team 10951" } as const;

/** A member's leadership titles with their organisations, `lead` first (e.g. on the FRC page, FRC first). */
export function leadershipRoles(member: Member, lead: "jpl" | "frc" = "jpl") {
	const titles = member.data.leadership ?? {};
	const order = lead === "jpl" ? (["jpl", "frc"] as const) : (["frc", "jpl"] as const);
	return order.flatMap((key) => (titles[key] ? [{ key, title: titles[key]!, org: ORG[key] }] : []));
}

/** Members with a leadership title, CEO first, then COO, then everyone else by name. */
export async function getLeaders() {
	const rank = (m: Member) => {
		const i = ["CEO", "COO", "CTO"].indexOf(m.data.leadership?.jpl ?? "");
		return i === -1 ? 99 : i;
	};
	return (await getMembers()).filter((m) => m.data.leadership).sort((a, b) => rank(a) - rank(b));
}
