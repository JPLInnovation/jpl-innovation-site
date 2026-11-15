/**
 * MEMBERS PAGE TEXT (/members/) and the headings on each member's own page.
 *
 * Each person's name, photo, roles, skills, places, path and story are in their own file: src/text/members/*.md
 * Leadership titles (CEO, COO, Mechanical Lead...) are the `leadership:` lines in those files.
 */

export const membersPage = {
	seoTitle: "Members | JPL Innovation",
	seoDescription: "The students behind JPL Innovation.",
	title: "Members",
	lede: "The students behind JPL Innovation.",
	/** The crew sheet: its heading and the line under it. */
	leadershipHeading: "Leadership",
	leadershipIntro: "Who leads JPL Innovation, and the roles they also hold on FRC Team 10951.",
	/** How each person signs the sheet, in order (leaders first); anyone after these signs as `signOffMore`. */
	signOff: ["Drawn by", "Checked by"],
	signOffMore: "Crew",
	/** Under the 3D badges. */
	badgesHeading: "Member badges in 3D",
	badgesHint: "Point at a badge to turn it toward you; click to open that member.",
};

/** Headings on each member's page (/members/jayden/ ...). */
export const memberPage = {
	backLink: "All members",
	/** The title block beside the portrait. */
	titleBlockLabel: "Title block",
	rolesLabel: "Roles",
	/** The map of Vietnam. */
	mapHeading: "On the map",
	mapLabel: "A hand-drawn map of Vietnam, marking",
	pathHeading: "The path so far",
	islands: { hoangSa: "Quần đảo Hoàng Sa", truongSa: "Quần đảo Trường Sa" },
	skillsHeading: "Technical skills",
	achievementsHeading: "Achievements",
	/** The achievements table's two columns. */
	achievementsColumns: ["Achievement", "Result"],
	sportsHeading: "Sports",
	storyHeading: "Story",
};
