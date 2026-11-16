/**
 * The studio laptop's ground station (src/components/Studio.astro): what it reads off the SIMULATED flight
 * (src/lib/studio/sim-flight.ts), from two samples of the drone's pose. Rounded the way a ground station shows them.
 */
export interface Sample {
	/** Position in the simulated world (metres, y up). */
	x: number;
	y: number;
	z: number;
	/** Heading about y (radians; 0 = facing +z, as the flight world gives it). */
	yaw: number;
	/** When (seconds). */
	t: number;
}

export interface Telemetry {
	/** Height above the ground (m, one decimal). */
	altitude: number;
	/** Ground speed (m/s, one decimal). */
	speed: number;
	/** Compass heading (degrees, 0 to 359): 0 toward the far pad (-z), 90 toward +x. */
	heading: number;
	/** Distance to the far pad, along the ground (m, whole). */
	toPad: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function telemetry(last: Sample | undefined, now: Sample, pad: { x: number; z: number }): Telemetry {
	const dt = last ? now.t - last.t : 0;
	const speed = last && dt > 0 ? Math.hypot(now.x - last.x, now.y - last.y, now.z - last.z) / dt : 0;
	const heading = Math.round(((((180 - (now.yaw * 180) / Math.PI) % 360) + 360) % 360)) % 360;
	return { altitude: round1(now.y), speed: round1(speed), heading, toPad: Math.round(Math.hypot(pad.x - now.x, pad.z - now.z)) };
}
