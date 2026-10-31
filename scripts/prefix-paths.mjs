/**
 * Serves a build from a sub-address, e.g. https://jpl-innovation.github.io/jpl_site2/ (a project repository's Pages
 * address). The site is written for the root of a domain, with links and files like "/work/" and "/assets/x.webp" in the
 * pages, the scripts and the styles; this puts the prefix in front of them in a finished build.
 *
 *   node scripts/prefix-paths.mjs dist /jpl_site2
 *
 * Only paths that begin with one of the site's own top-level folders or pages, and sit right after a quote, a bracket,
 * an equals sign or a comma, are changed (so "https://host/work/" is left alone). Used by .github/workflows/deploy-subpath.yml.
 */
import fs from "node:fs";
import path from "node:path";

const [dir, prefix] = process.argv.slice(2);
if (!dir || !prefix?.startsWith("/")) throw new Error("usage: node scripts/prefix-paths.mjs <dist> </prefix>");
const tops = "chapter|work|members|about|assets|studio|showcase|fonts|_astro|favicon\\.png|apple-touch-icon\\.png|404";
const re = new RegExp(`(["'(=,]\\s*|, |&quot;)/(?=(?:${tops})(?:[/"'\\s)?#.&]|$))`, "g");
const home = /(href=["'])\/(?=["'#])/g;
// The script loader builds its chunk addresses as "/" + file (Vite's preload helper).
const loader = /return"\/"\+(\w+)\}/g;
let files = 0;
let changes = 0;
const walk = (d) => {
	for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
		const file = path.join(d, entry.name);
		if (entry.isDirectory()) walk(file);
		else if (/\.(html|js|mjs|css|json|webmanifest|svg|xml|txt)$/.test(entry.name)) {
			const before = fs.readFileSync(file, "utf8");
			const after = before
				.replace(re, (_m, lead) => ((changes++), `${lead}${prefix}/`)).replace(home, (_m, a) => ((changes++), `${a}${prefix}/`))
				.replace(loader, (_m, v) => ((changes++), `return"${prefix}/"+${v}}`));
			if (after !== before) {
				fs.writeFileSync(file, after);
				files++;
			}
		}
	}
};
walk(dir);
console.log(`prefixed ${changes} paths in ${files} files with ${prefix}`);
