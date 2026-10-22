/**
 * THE STUDIO (the home page's 3D workspace, src/components/Studio.astro): the words that belong to the studio
 * itself. Each scene's own text comes from the home page's text (src/text/home.ts and src/text/site.ts), so nothing
 * is written twice.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 */

export const studio = {
	/** Read by screen readers for the 3D view. */
	canvasLabel:
		"The JPL Innovation studio in 3D: a desk with a sketchbook and a monitor, workbenches for robots, drones, networks and the web, a wall of projects, a whiteboard, a window, the team's table and the door.",
	/** The film ruler at the bottom: what it is, for screen readers. */
	rulerLabel: "Scenes in the studio",
	/** Under the first scene, before anyone has scrolled. */
	scrollHint: "Scroll to move through the studio",
	/** The last scene's way back to the first. */
	backToStart: "Back to the start",
	/** Shown in the corner of read mode (phones, reduced motion, no 3D). */
	readModeNote: "Read mode",
	/** Over each work station's text: "What we do · 1 of 4". */
	stationOf: "of",
};

/**
 * Each scene's name on the ruler, in order. The ids are fixed (the 3D camera and the page's links use them); change
 * the names freely.
 */
export const sceneNames: Record<string, string> = {
	title: "JPL Innovation",
	sketch: "Sketch",
	research: "Research",
	robotics: "Robotics",
	drones: "Drones",
	networks: "Networks",
	web: "Web",
	wall: "Selected work",
	standards: "Standards",
	timeline: "Timeline",
	crew: "The team",
	contact: "Contact",
};
