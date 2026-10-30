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
	build: "Build",
	test: "Test",
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

/**
 * THE LOOSE SHEETS around the sketchbook and pinned on the wall by the desk (src/lib/studio/desk-sheets.ts): working
 * pages from the F450's build, drawn by hand. Every fact is from the drone page (src/text/projects/drone.ts). The
 * failed designs are left empty on purpose: only Jayden's own list goes there (see `failed`).
 */
export const deskSheets = {
	topView: { title: "F450 from above", diag: "450 mm", front: "front", motors: "A2212 1000KV" },
	power: { title: "Power", steps: ["3S LiPo 2200 mAh", "switch 60 A+", "PDB (bottom plate)", "IO board", "4× ESC 30 A", "4× motors"], branch: "Matek BEC 5 V 5 A → Pi 4", note: "own 5 V: never brown out the FC" },
	video: { title: "Live video", steps: ["Camera Module 3", "Pi 4", "ZTE MF833 4G", "viewer, anywhere"], links: ["CSI", "USB", "4G + Tailscale"] },
	control: { title: "Flight control", steps: ["MC6C radio", "MC7RE V2", "MicoAir743 V2", "IO board", "4× ESC"], links: ["2.4 GHz", "SBUS", "8-pin"], branch: "USB-C → Pi 4: MSP telemetry" },
	tilt: { title: "Camera tilt mount", material: "printed PETG", level: "0°", down: "45° down", ribbon: "CSI ribbon" },
	fc: { title: "FC", model: "MicoAir743 V2", size: "30 × 30 mm", firmware: "INAV 9.1", warn: "its 5 V never to the Pi!" },
	props: { title: "Props 10 × 4.5", cw: "CW", ccw: "CCW", note: "2 CW, 2 CCW: quad X" },
	parts: { title: "Parts", items: ["F450 frame", "4× A2212 1000KV", "4× 30 A ESC", "1045 props", "150 mm legs", "MicoAir743 V2", "MC7RE V2 receiver", "3S 2200 mAh", "Matek BEC12S-PRO", "Raspberry Pi 4", "Camera Module 3", "ZTE MF833 4G"] },
	legs: { title: "Landing gear", height: "150 mm", note: "battery, Pi + camera hang under the frame" },
	battery: { title: "Battery", pack: "3S 2200 mAh", note: "under the frame, strapped" },
	modem: { title: "4G stick", model: "ZTE MF833", note: "USB 2.0 to the Pi" },
	ideas: { title: "Ideas, later", items: ["hold position (no drift)", "return to the landing spot", "follow a person", "hand gestures"], note: "after the first hover" },
	/** Failed designs: Jayden's own list goes here (what we tried, why it failed, what we changed). Empty until then. */
	failed: [] as { title: string; why: string; fix: string }[],
};

/** THE BUILD AND TEST SCENES (the bench between the desk and the robot cart). Facts from src/text/projects/drone.ts. */
export const buildStory = {
	build: {
		tag: "F450 · Build",
		heading: "Then we build it, piece by piece",
		body: "Frame and power first, then the flight controller, ESCs and receiver, then the Pi 4, the camera and the 4G stick. Every part you see coming together is from the drone's real CAD.",
	},
	test: {
		tag: "F450 · Test",
		heading: "Then we test it",
		bench: "On the bench, these passed:",
		body: "The first hover comes after the printed mounts. Until then, the flight on the screen is a simulation of our 3D model, not real footage.",
		label: "Simulation · not flown yet",
	},
};
