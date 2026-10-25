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
		"The JPL Innovation studio in 3D: a desk with a sketchbook and a monitor, workbenches for robots, drones, networks and testing, a wall of projects, a whiteboard, a window, the team's table and the door.",
	/** The film ruler at the bottom: what it is, for screen readers. */
	rulerLabel: "Scenes in the studio",
	/** Under the first scene, before anyone has scrolled. */
	scrollHint: "Scroll to move through the studio",
	/** The last scene's way back to the first. */
	backToStart: "Back to the start",
	/** Shown in the corner of read mode (phones, reduced motion, no 3D). */
	readModeNote: "Read mode",
	/** On the monitor and the laptop when the pointer is on them: their pages scroll with the mouse wheel. */
	screenHint: "Scroll to read",
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
	web: "Testing",
	wall: "Selected work",
	standards: "Standards",
	timeline: "Timeline",
	crew: "The team",
	contact: "Contact",
};

/**
 * THE SKETCHBOOK on the desk (the second scene), drawn by hand-style strokes in src/lib/studio/sketch.ts: the F450 drone's
 * design page, a list of what it has to do and sketches of the camera, the flight controller and how it all fits together.
 *
 * Every fact here is from the drone page's own words (src/text/projects/drone.ts): if one changes there, change it here
 * too. The sketch only says what the plan says (nothing here claims the drone has flown). Short lines: they are written
 * in a notebook, not a report. The roadmap strip's "we are here" follows the roadmap's own state (drone.ts).
 */
export const sketchText = {
	title: "F450 4G drone",
	status: "not flown yet",
	criteriaHeading: "What it has to do",
	criteria: [
		"Live video over 4G: watch it from anywhere",
		"Camera tilts 0 to 45° down",
		"Pi on its own 5 V, so it never browns out the FC",
		"Fly it by radio, with little lag",
		"Battery and attitude on a dashboard (USB, MSP)",
	],
	camera: {
		heading: "Camera",
		model: "Camera Module 3",
		specs: "12 MP, autofocus, 720p60 or 1080p30",
		mount: "printed PETG tilt mount",
		ribbon: "CSI ribbon to the Pi",
		level: "0°",
		down: "45° down",
	},
	fc: {
		heading: "Flight controller",
		model: "MicoAir743 V2",
		specs: "H743, 30 × 30 mm, INAV 9.1",
		sbus: "SBUS from the receiver",
		ioBoard: "8-pin cable to the IO board",
		usb: "USB-C to the Pi: MSP telemetry",
		warning: "its 5 V never goes to the Pi!",
	},
	drone: {
		frame: "F450 · 450 mm",
		front: "front",
		fc: "FC",
		io: "IO board",
		receiver: "receiver MC7RE V2",
		motors: "A2212 1000KV + 30 A ESC",
		props: "props 10 × 4.5: 2 CW, 2 CCW",
		underneath: "hangs under the frame",
		battery: "3S 2200 mAh",
		bec: "Matek BEC 5 V 5 A",
		pi: "Raspberry Pi 4",
		modem: "ZTE MF833 4G",
		viewer: "watch from anywhere",
		link: "4G + Tailscale",
	},
	/**
	 * The roadmap's six steps, short, one for each step of drone.ts's roadmap and in its order (each takes that step's
	 * done / current / upcoming). A long one wraps onto two lines.
	 */
	steps: ["design & parts", "frame & power", "FC setup", "4G video", "printed mounts", "First hover & tuning"],
	here: "we are here",
	/** Under a step that hasn't started yet. */
	planned: "planned",
};

export type SketchText = typeof sketchText;

/**
 * THE EASEL WHITEBOARD on the test bench (the "Testing" scene): the F450's bench test, written by hand. `passed` get a
 * tick, `next` an empty box. Keep it in step with the drone page's roadmap (src/text/projects/drone.ts).
 */
export const benchBoard = {
	title: "F450 bench test",
	passed: ["Flight controller", "ESCs", "Receiver", "Pi 4 companion", "4G video link"],
	nextHeading: "Next",
	next: ["Printed mounts", "Balance check", "First hover", "PID tuning"],
};
