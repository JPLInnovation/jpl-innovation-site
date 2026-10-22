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
	/** 0 Title: the desk from across the room, under the lamp, with the logo on the wall. */
	title: { id: "title", camera: [-6.0, 1.45, 2.3], target: [-6.0, 1.45, -2.6] },
	/** 1 Sketch: above the desk, looking down into the open sketchbook. */
	sketch: { id: "sketch", camera: [-6.3, 1.62, -1.45], target: [-6.32, 0.79, -2.32] },
	/** 2 Research: slid right to the monitor. */
	research: { id: "research", camera: [-5.12, 1.2, -1.32], target: [-5.12, 1.11, -2.7] },
	/** 3 Stations: the four work areas, one after another. */
	robotics: { id: "robotics", camera: [-2.6, 1.5, 0.2], target: [-2.6, 0.72, -2.5] },
	drones: { id: "drones", camera: [-0.6, 1.45, 0.1], target: [-0.6, 0.95, -2.5] },
	networks: { id: "networks", camera: [1.4, 1.5, 0.2], target: [1.4, 1.2, -2.8] },
	web: { id: "web", camera: [3.3, 1.3, -0.4], target: [3.3, 0.98, -2.5] },
	/** 4 The wall: the curved wall of project panels at the end of the room. */
	wall: { id: "wall", camera: [4.4, 1.55, 1.3], target: [7.4, 1.45, 1.0] },
	/** 5 Standards: the whiteboard and the shelf of binders, on the back wall. */
	standards: { id: "standards", camera: [5.0, 1.55, 3.0], target: [5.0, 1.45, 6.4] },
	/** 6 Timeline: the long window. */
	timeline: { id: "timeline", camera: [1.2, 1.55, 2.6], target: [1.2, 1.6, 6.4] },
	/** 7 The crew: two chairs at the table, a portrait screen by each. */
	crew: { id: "crew", camera: [-2.4, 1.6, 2.4], target: [-2.4, 1.15, 6.0] },
	/** 8 Contact: the doorway with the lit sign. */
	contact: { id: "contact", camera: [-5.6, 1.55, 2.5], target: [-5.6, 1.5, 6.4] },
	/** The prototype's flight: up and across the room, the whole studio in view. */
	flight: { id: "flight", camera: [0.5, 2.9, 4.6], target: [0.5, 0.6, -1.6] },
};

/** The home page's scenes, in order. */
export const HOME = ["title", "sketch", "research", "robotics", "drones", "networks", "web", "wall", "standards", "timeline", "crew", "contact"];
/** The Phase 1 prototype (/studio/): desk to screen, one flight across the room, and the loop back. */
export const PROTOTYPE = ["title", "sketch", "research", "flight"];
