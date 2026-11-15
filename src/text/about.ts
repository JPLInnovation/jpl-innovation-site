/**
 * ABOUT PAGE TEXT (/about/). The page is the founders' letter: the title and its film, the letter ("Our story") with a
 * tear-off strip carrying the email, what we work on, the team, what we believe.
 *
 * The people in "The team" (names, photos, CEO/COO and FRC titles) come from src/text/members/*.md,
 * so edit them there. The contact box at the bottom is the same one as on every page: src/text/site.ts → `contact`.
 * The email address on the tear-off strip is site.ts → `site.email`.
 */
import { frcPhotos } from "./projects/frc";

export const aboutPage = {
	/** Browser tab title and the description Google and link previews show. */
	seoTitle: "About | JPL Innovation",
	seoDescription:
		"A student-led engineering initiative founded in 2025 by Jayden Phan Le and Khoa Le. Robotics, drones, embedded software and cybersecurity, documented end to end.",
	title: "About JPL Innovation",
	lede: "JPL Innovation is a student-led engineering initiative founded in 2025 by Jayden Phan Le and Khoa Le. From competition robotics to drones, embedded software, and cybersecurity, we document every project from first idea to final result, including the lessons learned along the way.",
};

/** The drawing's title block beside the page title: the facts of this sheet, a caption over each value. */
export const titleBlock = {
	/** Read aloud before the cells. */
	label: "Title block",
	rows: [
		{ label: "Founded", value: "October 2025" },
		{ label: "Where", value: "Ho Chi Minh City" },
		{ label: "Founder", value: "Jayden Phan Le" },
		{ label: "Co-founder", value: "Khoa Le" },
	],
};

/**
 * "Play the story": the founding of JPL told as a short film over our own pictures, its subtitles writing themselves.
 * The same story is the letter below it, so nobody has to watch it. Each chapter: its `name` (shown large, and on the
 * chapter bar), its `lines` (the subtitles, in order) and its `shots` (the pictures, shown one after another while
 * its lines run). The film's length is worked out from the lines, so it changes by itself when they do.
 * A shot's `src` is the full picture and `small` a copy about 640–800 px wide for phones; `w` is `src`'s width in pixels.
 * `fit: "contain"` shows a cut-out render whole (the CAD), instead of filling the screen.
 */
export const film = {
	button: "Play the story",
	/** The picture on the button (the sketchbook on the studio desk); the film opens out of it. */
	poster: { src: "/studio/scenes/sketch.webp", small: "/studio/scenes/sketch-800.webp", w: 1600, h: 900 },
	/** The film's name, read aloud when it opens. */
	title: "The story of JPL Innovation",
	skip: "Skip",
	pause: "Pause",
	play: "Play",
	/** Read aloud for the row of chapter buttons at the bottom. */
	chaptersLabel: "Chapters",
	/** The last screen: the site's two editions (the words for Glass and Solid are Settings' own, in site.ts). */
	edition: {
		heading: "Choose your edition",
		after: "You can change it any time in Settings, the gear at the top of the page.",
		back: "Back to the page",
		again: "Watch again",
	},
	chapters: [
		{
			name: "Saigon",
			lines: ["Saigon, October 2025.", "Jayden Phan Le starts JPL Innovation, with co-founder Khoa Le."],
			shots: [{ src: "/assets/frc/b0.webp", small: "/assets/frc/b0-640.webp", w: 2340, alt: frcPhotos.b0.alt }],
		},
		{
			name: "The first sketch",
			lines: ["It began with a simple idea:", "every project we build deserves to be documented, not just finished."],
			shots: [
				{ src: "/assets/frc/st0.webp", small: "/assets/frc/st0-640.webp", w: 1800, alt: frcPhotos.st0.alt },
				{ src: "/studio/scenes/sketch.webp", small: "/studio/scenes/sketch-800.webp", w: 1600, alt: "The F450 drone's design page, open in the sketchbook on the studio desk." },
			],
		},
		{
			name: "The drone",
			lines: ["An F450 quadcopter that streams live video over 4G,", "and a custom C++ telemetry system to go with it."],
			shots: [
				{ src: "/showcase/drone/overview.webp", small: "/showcase/drone/overview-800.webp", w: 1600, fit: "contain", alt: "The F450 drone in CAD: the frame, four motors and propellers, the flight stack and the camera mount." },
				{ src: "/showcase/drone/camera.webp", small: "/showcase/drone/camera-800.webp", w: 1600, fit: "contain", alt: "The F450 in CAD, the camera module on its tilt mount under the frame." },
			],
		},
		{
			name: "The team",
			lines: ["On FIRST Robotics Competition Team 10951, we build competition robots", "under real deadlines and constraints."],
			shots: [
				{ src: "/assets/frc/b1.webp", small: "/assets/frc/b1-640.webp", w: 2340, alt: frcPhotos.b1.alt },
				{ src: "/assets/frc/ws.webp", small: "/assets/frc/ws-640.webp", w: 2520, alt: frcPhotos.ws.alt },
				{ src: "/assets/frc/h1.webp", small: "/assets/frc/h1-640.webp", w: 2160, alt: frcPhotos.h1.alt },
			],
		},
		{
			name: "Next",
			lines: ["Every project, from first idea to final result, on the record.", "JPL Innovation is where we learn by building."],
			shots: [{ src: "/assets/frc/g10.webp", small: "/assets/frc/g10-640.webp", w: 2520, alt: frcPhotos.g10.alt }],
		},
	],
};

/**
 * The letter ("Our story" below is its body). It is signed by the founders, and its foot is a strip you could tear
 * off, carrying the email address (site.ts → `site.email`); the strip opens the email pop-up.
 */
export const letter = {
	signatures: [
		{ name: "Jayden Phan Le", role: "Founder" },
		{ name: "Khoa Le", role: "Co-founder" },
	],
	/** Before the signatures. */
	signOff: "From the founders,",
	strip: {
		/** Beside the scissors on the dotted line (read aloud too). */
		tear: "Tear here",
		/** Above the address on the strip. */
		note: "Write to us",
	},
};

/** "Our story". Each item in `paragraphs` is one paragraph. */
export const story = {
	heading: "Our story",
	paragraphs: [
		"JPL Innovation is a student-led technology and engineering initiative founded in October 2025 by Jayden Phan Le, with co-founder Khoa Le. It began with a simple idea: every project we build and every problem we solve deserves to be documented, not just finished. JPL Innovation turns that work into a lasting, public record of our growth as engineers.",
		"Our work spans mechanical design, embedded systems, software, and cybersecurity. As Mechanical Lead and Electrical Lead on FIRST Robotics Competition Team 10951, we design and build competition robots under real deadlines and constraints. Beyond robotics, we develop independent projects such as an F450 quadcopter with 4G video streaming and a custom C++ telemetry system, and we explore networking and cybersecurity through hands-on study and certification.",
		"We believe the process matters as much as the product. Each project on this site covers the full story: the goal, the design decisions, the failures, and what we learned from them. Our aim is to build real engineering skill, share knowledge openly, and hold ourselves to a professional standard long before we reach university.",
		"JPL Innovation is where we learn by building, and where that learning is on the record.",
	],
};

/**
 * "What we work on". `project` is the name of the project's file in src/text/projects/ (frc.md → "frc"):
 * the row shows that project's picture and links to its page. `picture` (optional) shows another real picture
 * instead (a path in public/, its width in pixels, and an 800 px copy for small screens).
 */
export const focus = {
	heading: "What we work on",
	intro: "Three tracks, each documented on its own page.",
	/** Put before the project's name on each card's link: "See FIRST Robotics". */
	linkPrefix: "See",
	areas: [
		{
			project: "frc",
			title: "FRC Team 10951 robotics",
			desc: "Designing and building competition robots with the Saigon South Dragons, under real deadlines and constraints.",
		},
		{
			project: "drone",
			title: "F450 drone and C++ telemetry",
			desc: "A quadcopter that streams live video over 4G, and a custom C++ telemetry system to go with it.",
			picture: { src: "/showcase/drone/overview.webp", small: "/showcase/drone/overview-800.webp", w: 1600, h: 1200 },
		},
		{
			project: "cybersecurity",
			title: "Cybersecurity and networking",
			desc: "Routing, switching and securing real networks through hands-on study and certification.",
		},
	],
} as const;

/** "The team" (the people come from src/text/members/*.md). */
export const team = {
	heading: "The team",
	intro: "JPL Innovation’s founders. Open a profile for their skills, achievements and story.",
};

/** "What we believe". Three short values. */
export const values = {
	heading: "What we believe",
	items: [
		{
			title: "Document everything",
			desc: "Every project deserves to be documented, not just finished: the goal, the design decisions, the failures, and what we learned.",
		},
		{
			title: "Learn by building",
			desc: "Real engineering skill comes from real builds. The process matters as much as the product.",
		},
		{
			title: "Hold a professional standard",
			desc: "We share our work openly and hold it to a professional standard, long before we reach university.",
		},
	],
} as const;
