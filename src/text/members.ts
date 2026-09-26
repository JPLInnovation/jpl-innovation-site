/**
 * MEMBERS PAGE TEXT (/members/) and the headings on each member's own page.
 *
 * Each person's name, photo, roles, skills and story are in their own file: src/text/members/*.md
 * Leadership titles (CEO, COO, Mechanical Lead...) are the `leadership:` lines in those files.
 */

export const membersPage = {
	seoTitle: "Members | JPL Innovation",
	seoDescription: "The students behind JPL Innovation.",
	title: "Members",
	lede: "The students behind JPL Innovation.",
	/** Under the "Leadership" heading. */
	leadershipHeading: "Leadership",
	leadershipIntro: "Who leads JPL Innovation, and the roles they also hold on FRC Team 10951.",
	/** Under the 3D badges. */
	badgesHint: "Point at a badge to turn it toward you; click to open that member.",
};

/** Headings on each member's page (/members/jayden/ ...). */
export const memberPage = {
	backLink: "All members",
	skillsHeading: "Technical skills",
	storyHeading: "Story",
};
