/**
 * DRONE PAGE, "PART BY PART" (/work/drone/, between "From parts list to first flight" and "Three systems, one drone").
 * The 3D drone turns to each part as its text comes up. Phones show each part's text as a card instead.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - Keep the features in this order: each one has its camera position in src/lib/three/models/drone-showcase.ts.
 *   - `id` is the part's link (/work/drone/#motors) and the name of its picture for phones,
 *     public/showcase/drone/<id>.webp (made by scripts/showcase-stills.py). Without a picture the card shows text only.
 *   - The drone hasn't flown yet: flight numbers are estimates from the build guide, so keep "(estimate)" on them.
 *   - The small label floating in the 3D view is the feature's `title`.
 */
export const droneShowcase = {
	heading: 'Part by part',
	intro: 'Where each part sits on the F450 and what it does. It hasn’t flown yet, so the flight numbers are estimates from the build guide.',
	/** Read aloud by screen readers instead of the 3D view. */
	modelLabel: '3D model of the F450 drone, turned to show the part described in the text.',
	/** Read aloud by screen readers for the row of dots that jump to each part. */
	dotsLabel: 'Parts of the drone',
	features: [
		{
			id: 'overview',
			title: 'The F450 frame',
			text: 'A 450 mm quadcopter frame in the quad-X layout. The red arms mark the front, and the bottom plate doubles as the power distribution board.',
			facts: [
				{ label: 'Frame', value: 'F450, 450 mm' },
				{ label: 'Layout', value: 'Quad-X' },
				{ label: 'Status', value: 'Bench tested, not flown yet' },
			],
		},
		{
			id: 'flight-controller',
			title: 'Flight controller',
			text: 'A MicoAir743 V2 runs INAV 9.1, soft-mounted on a fibreglass damping plate to keep motor vibration away from its sensors. The IO board in the middle of the top plate feeds the four ESCs and the flight controller.',
			facts: [
				{ label: 'Board', value: 'MicoAir743 V2 (H743)' },
				{ label: 'Firmware', value: 'INAV 9.1' },
				{ label: 'Receiver', value: 'MC7RE V2, 2.4 GHz, SBUS' },
				{ label: 'Radio', value: 'MC6C' },
			],
		},
		{
			id: 'motors',
			title: 'Motors and props',
			text: 'Four brushless motors, each with its own speed controller under the arm, turn 10-inch props. Two spin clockwise and two counter-clockwise, so their turning forces cancel out.',
			facts: [
				{ label: 'Motors', value: '4× A2212 1000KV' },
				{ label: 'ESCs', value: '4× BLHeli_S 30 A' },
				{ label: 'Props', value: '1045 (10 × 4.5 in)' },
				{ label: 'Thrust to weight', value: 'About 2.6 : 1 on a full pack (estimate)' },
			],
		},
		{
			id: 'power',
			title: 'Battery and power',
			text: 'A 3S LiPo powers everything through a switch rated 60 A or more. There’s no on-screen display, so a buzzer and a LiPo alarm beep when the battery runs low. The 150 mm legs keep the parts underneath about 11 cm off the ground.',
			facts: [
				{ label: 'Battery', value: '3S 2200 mAh LiPo' },
				{ label: 'Pi, camera and modem', value: 'Matek BEC12S-PRO, 5 V 5 A' },
				{ label: 'Flight time', value: '6 to 6.5 min (estimate)' },
				{ label: 'Takeoff weight', value: 'About 1.18 kg (estimate)' },
			],
		},
		{
			id: 'camera',
			title: 'Camera',
			text: 'A Raspberry Pi Camera Module 3 sits at the very front on a printed PETG tilt mount, set anywhere from 0 to 45° down and starting at 15°. A ribbon cable connects it to the Pi, and it weighs 142 g less than the Logitech C920 webcam it replaced.',
			facts: [
				{ label: 'Camera', value: 'Camera Module 3, 12 MP autofocus' },
				{ label: 'Video', value: '720p at 60 fps or 1080p at 30 fps' },
				{ label: 'Tilt', value: '0 to 45° down' },
			],
		},
		{
			id: 'video-link',
			title: '4G video link',
			text: 'A Raspberry Pi 4 encodes the video as H.264 with MediaMTX and sends it through a ZTE MF833 USB 4G modem. With Tailscale, anyone with the link can watch from anywhere online. The Pi also reads flight data from the flight controller over USB-C and serves a live dashboard.',
			facts: [
				{ label: 'Computer', value: 'Raspberry Pi 4, 4 GB' },
				{ label: 'Modem', value: 'ZTE MF833, 4G' },
				{ label: 'Software', value: 'MediaMTX and Tailscale' },
			],
		},
	],
};
