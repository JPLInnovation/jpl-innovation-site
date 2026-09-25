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
		roles: data.tags,
		img: data.img,
		skills: data.technical_skills.map((s) => ({ title: s.title, level: s.level })),
	};
}
