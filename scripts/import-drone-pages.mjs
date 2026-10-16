// Copies the three F450 artifacts into the site as standalone pages, each one a single self-contained HTML file:
//
//   build guide    → public/work/drone/build-guide/index.html
//   3D layout      → public/work/drone/3d-layout/index.html
//   camera mount   → public/work/drone/camera-mount/index.html
//
// What it changes in each file (and nothing else):
//   - a proper <head>: title, description, canonical address, favicon (the artifact's own <title> sat in the body)
//   - a "back to the F450 page" link
//   - every link to one of the three artifacts points at the site's copy instead
//   - the 3D layout and the camera mount save their downloads through Claude's runtime (window.claude); on the site a
//     small shim does the same with an ordinary browser download
// Every edit must match exactly the expected number of times, so an artifact that has changed shape fails loudly
// instead of half-applying. Save the artifacts' HTML first (the Artifact tool's read action keeps a copy).
//
// Run:  node scripts/import-drone-pages.mjs <guide.html> <layout.html> <mount.html>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [guideSrc, layoutSrc, mountSrc] = process.argv.slice(2);
if (!mountSrc) {
	console.error("Usage: node scripts/import-drone-pages.mjs <guide.html> <layout.html> <mount.html>");
	process.exit(1);
}

const SITE = "https://jpl-innovation.github.io";
const URLS = {
	guide: "/work/drone/build-guide/",
	layout: "/work/drone/3d-layout/",
	mount: "/work/drone/camera-mount/",
};
const ARTIFACT = {
	guide: "https://claude.ai/artifact/LSCedGzz6zpawuKuBP8SzY",
	layout: "https://claude.ai/artifact/YXxi4tU6JQajmQokXWpDVL",
	mount: "https://claude.ai/artifact/689CWs89ujq8qF3WGDLFMK",
};
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">';
const BACK_CSS = ".back{color:inherit;text-decoration:none}.back:hover{text-decoration:underline}";

const DOWNLOADS = `<script>/* The page saves its files through Claude's runtime (window.claude); here, an ordinary browser download does the same. */
if(!window.claude)window.claude={use:function(n){return Promise.resolve(n==="downloads"?{save:function(o){var u=URL.createObjectURL(o.data),a=document.createElement("a");a.href=u;a.download=o.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4e4);return Promise.resolve()}}:null)}};</script>`;

const head = (title, description, path, extra = "") =>
	'<!doctype html><html lang="en"><head><meta charset="utf-8">' +
	'<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
	`<title>${title}</title><meta name="description" content="${description}">` +
	`<link rel="canonical" href="${SITE}${path}">` +
	'<link rel="icon" href="/favicon.png" type="image/png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
	extra;

/** Apply [old, new, expected count] edits in order. */
const edit = (text, edits) => {
	for (const [old, replacement, count] of edits) {
		const found = text.split(old).length - 1;
		if (found !== count) throw new Error(`expected ${count}x, found ${found}x: ${old.slice(0, 80)}`);
		text = text.split(old).join(replacement);
	}
	return text;
};
/** Point every link to one of the three artifacts at the site's copy; fail if any other claude.ai link is left. */
const relink = (text, name) => {
	for (const key of Object.keys(ARTIFACT)) text = text.split(ARTIFACT[key]).join(URLS[key]);
	const left = text.match(/https:\/\/claude\.ai\/[^"'\s<)]*/g);
	if (left) throw new Error(`${name}: a claude.ai link is left: ${left[0]}`);
	return text;
};
const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const guide = relink(
	edit(read(guideSrc), [
		[SKELETON, head("F450 4G Quad Build Guide | JPL Innovation", "Step-by-step bench guide for JPL Innovation's F450 4G drone: parts, power and signal wiring, the printed Camera Module 3 mount, INAV setup, Raspberry Pi 4G streaming, weight budget and first hover.", URLS.guide), 1],
		["<title>F450 4G Quad Build</title>\n", "", 1],
		['  <p class="rail-title">F450 build</p>', '  <a class="back" href="/work/drone/">← F450 4G Drone · JPL Innovation</a>\n  <p class="rail-title">F450 build</p>', 1],
		[
			".rail-title{font:700 23px/1 var(--display);letter-spacing:.01em;margin:0 0 12px}\n",
			".rail-title{font:700 23px/1 var(--display);letter-spacing:.01em;margin:0 0 12px}\n" +
				".rail .back{display:inline-block;font:600 12.5px var(--mono);color:var(--ink-2);text-decoration:none;margin:0 0 14px;padding:4px 0;border:0;background:none;border-radius:0;white-space:normal}\n" +
				".rail .back:hover{color:var(--pcb);background:none;text-decoration:underline}\n",
			1,
		],
	]),
	"build guide",
);

const layout = relink(
	edit(read(layoutSrc), [
		[SKELETON, head("F450 3D Layout | JPL Innovation", "Interactive 3D model of JPL Innovation's F450 4G drone: every part and wire from the build guide in place, a camera-tilt slider, and a download of the whole quad as a GLB plus the STL files to print.", URLS.layout, DOWNLOADS), 1],
		["<title>F450 3D Layout</title>\n", "", 1],
		['<p class="eyebrow">JPL Innovation · F450 4G quad</p>', '<p class="eyebrow"><a class="back" href="/work/drone/">← F450 4G Drone · JPL Innovation</a></p>', 1],
		[".eyebrow{margin:0;font:600 11px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--pcb)}\n", `.eyebrow{margin:0;font:600 11px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--pcb)}\n.eyebrow ${BACK_CSS.replace(".back:hover", ".eyebrow .back:hover")}\n`, 1],
		// the README inside the zip needs real addresses, not site-relative ones
		['"Camera mount page: " + MOUNT_URL, "Build guide: " + GUIDE,', '"Camera mount page: " + new URL(MOUNT_URL, location.href).href, "Build guide: " + new URL(GUIDE, location.href).href,', 1],
	]),
	"3D layout",
);

const mount = relink(
	edit(read(mountSrc), [
		[SKELETON, head("Camera Module 3 Tilt Mount | JPL Innovation", "The 3D-printed tilt mount for the F450's Camera Module 3: try every angle from 0 to 45 degrees, download the STL files, and follow the print and assembly sheet.", URLS.mount, DOWNLOADS), 1],
		["<title>CM3 Tilt Mount</title>\n", "", 1],
		['<p class="eyebrow">JPL Innovation · F450 4G quad</p>', '<p class="eyebrow"><a class="back" href="/work/drone/">← F450 4G Drone · JPL Innovation</a></p>', 1],
		[".eyebrow{margin:0;font:600 11px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--pcb)}\n", `.eyebrow{margin:0;font:600 11px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--pcb)}\n.eyebrow ${BACK_CSS.replace(".back:hover", ".eyebrow .back:hover")}\n`, 1],
		[`"Guide: ${ARTIFACT.guide}"`, `"Guide: ${SITE}${URLS.guide}"`, 1],
	]),
	"camera mount",
);

for (const [path, text] of [
	[URLS.guide, guide],
	[URLS.layout, layout],
	[URLS.mount, mount],
]) {
	const dir = `public${path}`;
	mkdirSync(dir, { recursive: true });
	writeFileSync(`${dir}index.html`, text);
	console.log(`${dir}index.html: ${(text.length / 1024).toFixed(0)} KB`);
}
