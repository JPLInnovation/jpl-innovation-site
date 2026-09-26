/**
 * WORK PAGE TEXT (/work/) and the words on every project card.
 *
 * Each project's card (title, description, badge, picture) is in its own file: src/text/projects/*.md
 * The order of the cards is the `order:` number in those files (lower comes first).
 */

export const workPage = {
	/** Browser tab title and the description Google shows. */
	seoTitle: "Work | JPL Innovation",
	seoDescription: "JPL Innovation's projects: FRC Team 10951, the F450 4G drone, and cybersecurity.",
	title: "Work",
	lede: "What we've built, what's on the bench now, and what's coming next.",
};

/** On every project card: "Read about F450 4G Drone" and so on. */
export const projectCard = {
	readMore: "Read about",
};

/** The "← All work" link at the top of each project page. */
export const backToWork = "All work";
