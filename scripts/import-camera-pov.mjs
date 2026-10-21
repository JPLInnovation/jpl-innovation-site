// Puts the F450 ground station (the dashboard that runs on the drone's Raspberry Pi) on the site as the drone page's
// "Camera POV": one self-contained HTML file at public/work/drone/camera-pov/index.html.
//
// Source: dashboard/src/index.html in github.com/jpl-innovation/drone-f450-jpl- (the page drone_dashboard.py serves).
// What it changes (and nothing else):
//   - a proper <head>: title, description, canonical address, favicon
//   - a bar on top: back to the F450 page, "Demo", what the demo is, and a link to the live drone when it's online
//   - scripts/camera-pov-demo.js, inlined ahead of the page's own script: a simulated flight in the dashboard's own
//     message format, a simulated camera view (a small 3D scene), and the live check (set LIVE_URL in that file once the drone has a
//     public address)
//   - the video code asks the demo layer for the feed instead of connecting to the Pi's camera server
// Every edit must match exactly the expected number of times, so a dashboard that has changed shape fails loudly
// instead of half-applying.
//
// Run:  node scripts/import-camera-pov.mjs <path to drone-f450-jpl->/dashboard/src/index.html
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [src] = process.argv.slice(2);
if (!src) {
	console.error("Usage: node scripts/import-camera-pov.mjs <dashboard/src/index.html>");
	process.exit(1);
}

const SITE = "https://jpl-innovation.github.io";
const PATH = "/work/drone/camera-pov/";
const OUT = `public${PATH}`;
const TITLE = "Camera POV · F450 ground station · JPL Innovation";
const DESCRIPTION =
	"The ground station for JPL Innovation's F450 4G drone: the camera view with a flight display over it, battery, motors, radio link and the Raspberry Pi's health. Running a simulated flight until the drone flies.";

/** Apply [old, new, expected count] edits in order. */
const edit = (text, edits) => {
	for (const [old, replacement, count] of edits) {
		const found = text.split(old).length - 1;
		if (found !== count) throw new Error(`expected ${count}x, found ${found}x: ${old.slice(0, 80)}`);
		text = text.split(old).join(replacement);
	}
	return text;
};

const demo = readFileSync("scripts/camera-pov-demo.js", "utf8");
if (demo.includes("</script")) throw new Error("camera-pov-demo.js must not contain </script");

const BAR_CSS = `
/* ---------- the website's bar (scripts/import-camera-pov.mjs) ---------- */
.pov-bar{max-width:1500px;margin:0 auto 12px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font:12.5px/1.45 var(--mono);color:var(--mute)}
.pov-bar a{color:var(--accent);text-decoration:none}
.pov-bar a:hover{text-decoration:underline}
.pov-back{font-weight:700;color:var(--text)!important;min-height:32px;display:inline-flex;align-items:center}
.pov-demo{font:700 11px var(--mono);letter-spacing:.12em;padding:4px 9px;border-radius:999px;background:var(--warn);color:#1a1204}
.pov-live{font-weight:700}
.pov-live[hidden]{display:none}
#demoFeed[hidden]{display:none}
`;

const BAR = `<div class="pov-bar">
  <a class="pov-back" href="/work/drone/">← F450 4G Drone</a>
  <span class="pov-demo">DEMO</span>
  <span>A simulated flight: the F450 hasn't flown yet. This is the ground station built for it, running on made-up data, with a simulated camera feed.</span>
  <span class="pov-live" id="povLive" hidden><a href="#" target="_blank" rel="noopener">The drone is online now: open the live ground station ↗</a></span>
</div>
`;

let html = readFileSync(src, "utf8");
html = edit(html, [
	[
		'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>F450 Ground Station</title>',
		'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
			`<title>${TITLE}</title>\n<meta name="description" content="${DESCRIPTION}">\n` +
			`<link rel="canonical" href="${SITE}${PATH}">\n` +
			'<link rel="icon" href="/favicon.png" type="image/png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">',
		1,
	],
	["</style>\n</head>", `${BAR_CSS}</style>\n</head>`, 1],
	["<body>\n", `<body>\n${BAR}`, 1],
	["<script>\n(function(){", `<script>\n${demo}\n</script>\n<script>\n(function(){`, 1],
	[
		"$('vLink').href = PUBLIC ? hlsBase : camBase;",
		"$('vLink').href = PUBLIC ? hlsBase : camBase;\nif (window.GS_DEMO) $('vLink').parentNode.hidden = true; /* the demo has no camera page */",
		1,
	],
	["function videoStop(){\n", "function videoStop(){\n  if (V.demoStop){ V.demoStop(); V.demoStop = null; }\n", 1],
	[
		"function videoStart(){\n  videoStop();\n  if (!prefs.video){ vState('off'); return; }\n",
		"function videoStart(){\n  videoStop();\n  if (!prefs.video){ vState('off'); return; }\n  if (window.GS_DEMO){ V.demoStop = window.GS_DEMO.video(vState); return; } /* the website's simulated feed */\n",
		1,
	],
]);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}index.html`, html);
console.log(`wrote ${OUT}index.html (${html.length} bytes)`);
