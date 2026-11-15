/**
 * WORK PAGE TEXT (/work/) and the words on every project card.
 *
 * Each project's card (title, description, status, picture) is in its own file: src/text/projects/*.md
 * The order of the projects is the `order:` number in those files (lower comes first).
 */
import { roadmap as droneRoadmap } from "./projects/drone";
import { roadmap as miniRoadmap } from "./projects/mini-drone";

export const workPage = {
	/** Browser tab title and the description Google shows. */
	seoTitle: "Work | JPL Innovation",
	seoDescription: "JPL Innovation's projects: the F450 4G drone, Lifetime, FRC Team 10951, the mini Arduino drone and cybersecurity.",
	title: "Work",
	lede: "What we've built, what's on the bench now, and what's coming next.",
	/** The title block under the lede: the drawing set's own details. "Sheets" is counted from the projects. */
	titleBlock: {
		label: "Title block",
		set: { label: "Drawing set", value: "JPL Innovation" },
		sheets: { label: "Sheets" },
		place: { label: "Drawn in", value: "Ho Chi Minh City" },
		line: { label: "Order of the set", value: "Sketch it. Build it. Secure it." },
	},
};

/** The Work page's 3D project wall (the words around it; the projects come from src/text/projects/*.md). */
export const workWall = {
	/** Read by screen readers for the 3D view. */
	canvasLabel: "A curved wall of project panels in 3D: the F450 4G drone, Lifetime, FIRST Robotics, the mini Arduino drone and cybersecurity.",
	rulerLabel: "Projects on the wall",
	hint: "Scroll to move along the wall · click a panel to open it",
	/** Heading over the register of projects (the same projects, as ordinary links). */
	listHeading: "All projects",
};

/**
 * THE REGISTER: the big table of projects on the Work page. A row opens into a plate (a whole-width picture).
 * One entry per project id (the file names in src/text/projects/).
 *   discipline  the kind of engineering, in a few words
 *   revision    where the sheet stands now (a version, a season, a build step); leave "" to show nothing
 *   picture     the plate's picture and its description for screen readers (also used by "Next chapter")
 */
const step = (roadmap: ReadonlyArray<{ title: string; state: string }>) => {
	const i = roadmap.findIndex((s) => s.state === "current");
	return i < 0 ? "" : `Step ${i + 1} of ${roadmap.length}: ${roadmap[i].title.toLowerCase()}`;
};

export const register = {
	columns: { project: "Project", discipline: "Discipline", status: "Status", revision: "Revision", open: "Open" },
	rows: {
		drone: {
			discipline: "Drones · embedded systems",
			/** Counted from the roadmap in src/text/projects/drone.ts. */
			revision: step(droneRoadmap),
			picture: { src: "/showcase/drone/overview.webp", alt: "The F450 4G drone's CAD model: red and white arms, four propellers, the Pi and camera under the top plate", fit: "contain" },
		},
		lifetime: {
			discipline: "Software",
			revision: "Version 1.1.0",
			picture: { src: "/assets/lifetime.svg", alt: "The Lifetime icon: a ring with a gap where a yellow dot orbits, around a small satellite", fit: "cover" },
		},
		frc: {
			discipline: "Competition robotics",
			revision: "2026 rookie season",
			picture: { src: "/assets/FRCnew.jpg", alt: "Team 10951's 2026 robot on the practice field, its intake rollers at the front", fit: "cover" },
		},
		"mini-drone": {
			discipline: "Drones · electronics",
			/** Counted from the roadmap in src/text/projects/mini-drone.ts. */
			revision: step(miniRoadmap),
			picture: { src: "/assets/mini-drone.svg", alt: "Illustration of the mini Arduino quadcopter seen from above", fit: "cover" },
		},
		cybersecurity: {
			discipline: "Networks · security",
			/** [CHECK] What stage is the cybersecurity track at (a CCNA module, a lab number)? Left empty: the cell shows nothing. */
			revision: "",
			picture: { src: "/assets/cybersecurity.svg", alt: "Diagram of the lab network: internet, an ACL shield, a router, a Layer 3 switch, two Layer 2 switches, four PCs and a Windows Server", fit: "cover" },
		},
	} as Record<string, { discipline: string; revision: string; picture: { src: string; alt: string; fit: "cover" | "contain" } }>,
};

/** On every project card: "Read about F450 4G Drone" and so on. */
export const projectCard = {
	readMore: "Read about",
};

/** The "← All work" link at the top of each project page. */
export const backToWork = "All work";

/** The end of each project page, leading to the next project (the last leads back to the first). */
export const nextChapter = {
	label: "Next chapter",
	/** When the project is the last one and the card leads back to the first. */
	loopLabel: "Back to the first chapter",
	open: "Read about",
};
