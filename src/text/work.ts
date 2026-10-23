/**
 * WORK PAGE TEXT (/work/) and the words on every project card.
 *
 * Each project's card (title, description, badge, picture) is in its own file: src/text/projects/*.md
 * The order of the cards is the `order:` number in those files (lower comes first).
 */

export const workPage = {
	/** Browser tab title and the description Google shows. */
	seoTitle: "Work | JPL Innovation",
	seoDescription: "JPL Innovation's projects: the F450 4G drone, FRC Team 10951, the mini Arduino drone and cybersecurity.",
	title: "Work",
	lede: "What we've built, what's on the bench now, and what's coming next.",
};

/** The Work page's 3D project wall (the words around it; the projects come from src/text/projects/*.md). */
export const workWall = {
	/** Read by screen readers for the 3D view. */
	canvasLabel: "A curved wall of project panels in 3D: the F450 4G drone, FIRST Robotics, the mini Arduino drone and cybersecurity.",
	rulerLabel: "Projects on the wall",
	hint: "Scroll to move along the wall · click a panel to open it",
	/** Heading over the plain list of projects under the wall (the same projects, as ordinary links). */
	listHeading: "All projects",
};

/** On every project card: "Read about F450 4G Drone" and so on. */
export const projectCard = {
	readMore: "Read about",
};

/** The "← All work" link at the top of each project page. */
export const backToWork = "All work";

/** The card at the end of each project page, leading to the next project (the last leads back to the first). */
export const nextChapter = {
	label: "Next chapter",
	/** When the project is the last one and the card leads back to the first. */
	loopLabel: "Back to the first chapter",
	open: "Read about",
};
