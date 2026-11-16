/**
 * The devices you can enter (the reference's "click the device, the camera flies in, the screen becomes the page"):
 *
 *   research   the desk monitor   the camera flies until the screen is the window, then the Work register is there as
 *                                 real HTML (the dialogs are in src/pages/index.astro, the wiring in Studio.astro)
 *   web        the test bench's laptop   into the ground station's camera feed: the SIMULATED flight plays on its own
 *                                 clock, with its telemetry in a panel beside it
 *   networks   the switch rack    up to its front, then the CCNA lab's console (src/components/IosTerminal.astro)
 *   robotics   the robot's cart   a three-quarter view; the robot turns, and comes apart into its CAD parts on a slider
 *   software   the software stand's monitor   as the desk monitor: the screen becomes the window, then Lifetime is
 *                                 there (its real screens, and the server's live demo: src/components/lifetime/LifetimeScreen.astro)
 *
 * Each device knows what to pick (for the pointer) and where the camera ends up. The engine flies there (engine.ts).
 */
import { Matrix4, type Mesh, type Object3D, type PerspectiveCamera, type Quaternion, Vector3 } from "three";
import type { Room } from "./room";
import type { SimFlight } from "./sim-flight";

export const DEVICE_IDS = ["research", "web", "networks", "robotics", "software"] as const;
export type DeviceId = (typeof DEVICE_IDS)[number];

export interface Device {
	id: DeviceId;
	/** What the pointer can click to enter it (its scene must be in view). */
	pick: Object3D[];
	/** Where the camera ends up. */
	pose(at: Vector3, q: Quaternion, camera: PerspectiveCamera): void;
}

const UP = new Vector3(0, 1, 0);
const look = new Matrix4();

/** The camera at `from`, looking at `to`. */
function lookPose(from: Vector3, to: Vector3, at: Vector3, q: Quaternion) {
	at.copy(from);
	q.setFromRotationMatrix(look.lookAt(from, to, UP));
}

/** The camera square in front of a flat screen, just far enough for the screen to fill the window. */
function fillPose(mesh: Mesh, camera: PerspectiveCamera, at: Vector3, q: Quaternion) {
	mesh.geometry.computeBoundingBox();
	const size = mesh.geometry.boundingBox!.getSize(new Vector3());
	const aspect = camera.aspect || 1.6;
	// Cover the window (the screen a touch bigger than it), so the page that replaces it starts where its edges are.
	const h = size.x / size.y > aspect ? size.y : size.x / aspect;
	const d = h / 2 / Math.tan((camera.fov * Math.PI) / 360);
	mesh.updateWorldMatrix(true, false);
	at.copy(mesh.localToWorld(new Vector3(0, 0, d)));
	mesh.getWorldQuaternion(q);
}

export function createDevices(room: Room, sim: SimFlight): Record<DeviceId, Device> {
	const { monitor, robot, rack, laptop, software } = room.parts;
	const rackFrom = rack.center.clone().add(new Vector3(0, 0, 1.15));
	// The robot from the front right and a little above; the point looked at sits to the robot's right, so it stands in
	// the left of the window, clear of the panel on the right.
	const robotFrom = robot.center.clone().add(new Vector3(1.15, 0.75, 1.75));
	const ahead = robot.center.clone().sub(robotFrom);
	const right = ahead.clone().cross(UP).normalize();
	const robotTo = robot.center.clone().addScaledVector(right, 0.55);
	return {
		research: { id: "research", pick: [monitor.mesh], pose: (at, q, camera) => fillPose(monitor.mesh, camera, at, q) },
		web: { id: "web", pick: [laptop], pose: (at, q) => sim.feedPose(at, q) },
		networks: { id: "networks", pick: [rack.group], pose: (at, q) => lookPose(rackFrom, rack.center, at, q) },
		robotics: { id: "robotics", pick: [robot.holder], pose: (at, q) => lookPose(robotFrom, robotTo, at, q) },
		software: { id: "software", pick: [software], pose: (at, q, camera) => fillPose(software, camera, at, q) },
	};
}
