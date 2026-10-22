/**
 * The studio's scenes: where the camera stands and what it looks at for each one. Metres, y up; the room runs along
 * x (-8.5 to 8.5), with the desk and the four work stations against the front wall (z = -3.4, the camera looking
 * toward -z) and the whiteboard, window, table and door against the back wall (z = 6.4, the camera looking toward +z).
 * See src/lib/studio/room.ts for what stands where.
 *
 * The camera travels a closed curve through these points in order, so after the last scene it curves back to the
 * first: the loop.
 */
export type V3 = [number, number, number];

export interface SceneShot {
	id: string;
	camera: V3;
	target: V3;
}

export const SHOTS: Record<string, SceneShot> = {
	/** 0 Title: the desk from across the room, under the lamp, with the logo on the wall; turned a little left, so the desk sits right of centre and the words have the empty wall beside it. */
	title: { id: "title", camera: [-6.0, 1.45, 2.3], target: [-6.9, 1.45, -2.6] },
	/** 1 Sketch: above the desk, looking down into the open sketchbook. */
	sketch: { id: "sketch", camera: [-6.3, 1.62, -1.45], target: [-6.32, 0.79, -2.32] },
	/** 2 Research: slid right to the monitor. */
	research: { id: "research", camera: [-5.12, 1.2, -1.32], target: [-5.12, 1.11, -2.7] },
	/**
	 * 3 Stations: the four work areas, one after another. Each subject sits on the side of the frame away from its text
	 * (text on the left: the subject to the right, and the other way round).
	 */
	robotics: { id: "robotics", camera: [-3.1, 1.35, -0.3], target: [-3.1, 0.75, -2.6] },
	drones: { id: "drones", camera: [-0.15, 1.4, -0.6], target: [-0.15, 1.0, -2.6] },
	networks: { id: "networks", camera: [0.95, 1.45, -0.4], target: [0.95, 1.25, -2.9] },
	web: { id: "web", camera: [3.65, 1.2, -1.45], target: [3.65, 0.98, -2.6] },
	/**
	 * 4 The wall: the curved wall of project panels at the end of the room, from the centre of its curve (stations.ts),
	 * turned a little left so the panels sit to the right of the text.
	 */
	wall: { id: "wall", camera: [3.6, 1.45, 1.0], target: [8.6, 1.45, -0.2] },
	/** 5 Standards: the whiteboard and the shelf of binders, on the back wall. */
	standards: { id: "standards", camera: [5.7, 1.5, 3.2], target: [5.7, 1.45, 6.4] },
	/** 6 Timeline: the long window, a year on each pane. */
	timeline: { id: "timeline", camera: [-0.3, 1.5, 0.9], target: [-0.3, 1.6, 6.4] },
	/** 7 The crew: the chairs at the table, a portrait screen behind each. */
	crew: { id: "crew", camera: [-1.8, 1.55, 2.3], target: [-1.8, 1.2, 6.0] },
	/** 8 Contact: the doorway with the lit sign. Then a turn on the spot, back to the desk: the loop. */
	contact: { id: "contact", camera: [-6.1, 1.55, 2.6], target: [-6.1, 1.45, 6.4] },
};

/** The home page's scenes, in order. */
export const HOME = ["title", "sketch", "research", "robotics", "drones", "networks", "web", "wall", "standards", "timeline", "crew", "contact"];
