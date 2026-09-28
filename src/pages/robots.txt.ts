import type { APIRoute } from "astro";

/** /robots.txt: everything may be crawled; points search engines at the sitemap. */
export const GET: APIRoute = ({ site }) =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", site).href}\n`, {
		headers: { "Content-Type": "text/plain" },
	});
