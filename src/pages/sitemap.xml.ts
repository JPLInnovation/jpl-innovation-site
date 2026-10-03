import type { APIRoute } from "astro";
import { getMembers, getProjects } from "@/lib/content";

/** /sitemap.xml: every page, for search engines. Projects and members come from src/text, so new ones appear here. */
export const GET: APIRoute = async ({ site }) => {
	const paths = [
		"/",
		"/work/",
		"/members/",
		"/about/",
		...(await getProjects()).map((p) => `/work/${p.id}/`),
		"/work/drone/build-guide/",
		...(await getMembers()).map((m) => `/members/${m.id}/`),
	];
	const urls = paths.map((path) => `<url><loc>${new URL(path, site).href}</loc></url>`).join("");
	return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
		headers: { "Content-Type": "application/xml" },
	});
};
