/**
 * F450 4G DRONE PAGE TEXT (/work/drone/), from top to bottom.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - The card title, description and picture on the Work page: src/text/projects/drone.md
 *   - Prices are estimates in VND. Leave `price` out for parts that aren't priced yet; the totals add up by themselves.
 *   - Labels inside the 3D drone: src/lib/three/models/drone.ts
 */

/** Headings and small labels on the drone page. The content (facts, steps, parts...) is further down. */
export const dronePage = {
	model3d: {
		/** Read aloud by screen readers instead of the 3D model. */
		description:
			'3D model of the F450 drone: red front arms, white rear arms and four spinning 10-inch props. The IO board, flight controller and receiver sit on the top plate. Under the frame, on tall white landing legs, hang the Camera Module 3 on its printed tilt mount at the front, the Raspberry Pi 4 with its Matek BEC, the LiPo battery and its alarm, and the 4G modem on a rear leg.',
		frontArms: 'Front arms',
		rearArms: 'Rear arms',
		layoutNote: 'Quad-X layout, 2 clockwise and 2 counter-clockwise props',
	},
	progressHeading: 'From parts list to first flight',
	stepLabel: 'Step',
	doneTag: 'Done',
	nowTag: 'Now',
	systemsHeading: 'Three systems, one drone',
	systemsIntro: 'How power, pilot commands and live video move through the build.',
	/** Before a branch in a system diagram: "Also from the flight controller". */
	branchPrefix: 'Also from the',
	/** The parts heading is "<number> parts, one budget". */
	partsHeadingSuffix: 'parts, one budget',
	totalLabel: 'Estimated total',
	totalNote: "Estimates from Vietnamese online stores. Parts that aren't priced yet aren't included.",
	/** Parts table column headings. */
	table: {
		part: 'Part',
		why: 'Why we need it',
		price: 'Price',
		notPriced: 'Not priced yet',
		subtotal: 'Subtotal',
		/** Screen-reader caption: "<group> parts and prices". */
		captionSuffix: 'parts and prices',
	},
	/** Before the date in the last section: "Earlier work, <date>". */
	earlierLabel: 'Earlier work,',
	/**
	 * Buttons under the facts: the step-by-step build guide, the interactive 3D layout and Camera POV (the drone's ground
	 * station). Each is one self-contained file in public/work/drone/: build-guide and 3d-layout come from the artifacts
	 * through scripts/import-drone-pages.mjs, camera-pov from the drone repo's dashboard through
	 * scripts/import-camera-pov.mjs. The camera mount page (public/work/drone/camera-mount/) stays on the site, linked
	 * from the build guide, but has no button here.
	 */
	buildGuide: {
		label: 'Open the build guide',
		note: 'Every stage from parts list to first hover, with wiring diagrams and checklists. The 3D layout shows every part and wire, and Camera POV is the drone’s ground station: what its camera sees, with the flight data over it.',
		href: '/work/drone/build-guide/',
	},
	layout3d: {
		label: 'Open the 3D layout',
		href: '/work/drone/3d-layout/',
	},
	cameraPov: {
		label: 'Camera POV',
		href: '/work/drone/camera-pov/',
	},
};

export interface Part {
	name: string;
	why: string;
	price?: number;
}

export interface PartGroup {
	id: string;
	title: string;
	icon: 'rocket-launch' | 'lightning' | 'target' | 'video-camera';
	/** A chart token (validated categorical order), used for the budget bar and legend. */
	color: string;
	parts: Part[];
}

export const drone = {
	name: 'F450 4G Drone',
	status: 'Build in progress',
	intro:
		'A quadcopter built on the classic F450 frame that streams live, high-quality video over the 4G mobile network — so it can be watched from anywhere with signal, not just within Wi-Fi range.',
	/** Who's building it. `members` are ids from src/text/members/*.md; leave a role's `member` out to show the name only. */
	team: [
		{ role: 'Electrical: soldering & wiring', member: 'khoa' },
		{ role: 'Everything else: design, flight software & assembly', member: 'jayden' },
		{ role: 'Power-system advice, including the Matek BEC: a professional drone builder in Vietnam' },
	],
	facts: [
		{ icon: 'rocket-launch', label: 'Frame', value: 'F450 · 450 mm' },
		{ icon: 'lightning', label: 'Battery', value: '3S 2200 mAh' },
		{ icon: 'cell-signal', label: 'Video link', value: '4G LTE' },
		{ icon: 'target', label: 'Props', value: '10 × 4.5″' },
	],
} as const;

export const roadmap = [
	{ title: 'Design & parts list', desc: 'Components chosen and budgeted.', state: 'done' },
	{ title: 'Sourcing parts', desc: 'Main parts in hand; the printed camera mount and a few cables still to get.', state: 'current' },
	{ title: 'Frame & power assembly', desc: 'Motors, ESCs, IO board, battery switch, Matek BEC and 150 mm legs on the F450.', state: 'upcoming' },
	{ title: 'Flight controller setup', desc: 'INAV 9.1, calibration, radio binding, failsafe tests and the first hover.', state: 'upcoming' },
	{ title: '4G video link', desc: 'Pi 4 streaming the Camera Module 3 over 4G, with a live dashboard of the flight data.', state: 'upcoming' },
	{ title: 'Field testing', desc: 'Test flights and tuning.', state: 'upcoming' },
] as const;

/** How the parts connect. `link` labels the connection *into* that step. */
export const systems = [
	{
		title: 'Power',
		icon: 'lightning',
		steps: [
			{ name: '3S LiPo', detail: '2200 mAh' },
			{ name: 'On/off switch', detail: 'rated 60 A+' },
			{ name: 'PDB', detail: 'the bottom plate' },
			{ name: 'IO board', detail: 'feeds the ESCs & FC', link: '12 AWG' },
			{ name: '4× ESC', detail: '30 A' },
			{ name: '4× Motors', detail: 'A2212 1000KV' },
		],
		branch: {
			from: 'PDB',
			steps: [
				{ name: 'Matek BEC', detail: '5 V, 5 A, its own supply' },
				{ name: 'Pi 4', detail: '+ camera & 4G modem' },
			],
		},
	},
	{
		title: 'Flight control',
		icon: 'target',
		steps: [
			{ name: 'MC6C radio', detail: 'pilot’s transmitter' },
			{ name: 'MC7RE V2', detail: 'receiver on the drone', link: '2.4 GHz' },
			{ name: 'MicoAir743 V2', detail: 'flight controller, INAV 9.1', link: 'SBUS' },
			{ name: 'IO board', detail: 'ESC signals', link: '8-pin cable' },
			{ name: '4× ESC', detail: 'motor speed' },
		],
		branch: {
			from: 'flight controller',
			steps: [
				{ name: 'USB-C cable', detail: 'MSP telemetry' },
				{ name: 'Pi 4', detail: 'reads attitude & battery' },
				{ name: 'Dashboard', detail: 'live video & flight data' },
			],
		},
	},
	{
		title: 'Live video',
		icon: 'video-camera',
		steps: [
			{ name: 'Camera Module 3', detail: 'on a printed tilt mount' },
			{ name: 'Pi 4', detail: 'encode & stream', link: 'CSI ribbon' },
			{ name: '4G modem', detail: 'ZTE MF833', link: 'USB 2.0' },
			{ name: 'Viewer', detail: 'anywhere online', link: '4G + Tailscale' },
		],
	},
] as const;

export const partGroups: PartGroup[] = [
	{
		id: 'airframe',
		title: 'Airframe & propulsion',
		icon: 'rocket-launch',
		color: 'var(--chart-1)',
		parts: [
			{ name: 'F450 Drone Frame', why: 'A large, strong frame with plenty of room for all the electronics. Its bottom plate is the power distribution board.', price: 180_000 },
			{ name: '4× A2212 1000KV Brushless Motors', why: 'The classic motors for the F450 frame — 2 clockwise, 2 counter-clockwise.', price: 142_000 },
			{ name: '4× BLHeli_S 30A ESCs', why: 'Electronic speed controllers that drive the brushless motors, one under each arm.', price: 150_000 },
			{ name: '1045 Propellers', why: 'Big 10-inch propellers matched to the 2212 motors.', price: 40_000 },
			{ name: 'High Landing Gear (150 mm)', why: 'The battery, Pi and camera hang under the frame, so these white legs keep them about 11 cm off the ground.', price: 130_000 },
			{ name: 'Anti-vibration Dampers', why: 'Rubber grommets that isolate the flight controller from motor vibration.', price: 30_000 },
		],
	},
	{
		id: 'power',
		title: 'Power',
		icon: 'lightning',
		color: 'var(--chart-2)',
		parts: [
			{ name: 'LiPo Battery 3S 2200 mAh', why: 'The power needed to lift this heavier rig.', price: 360_000 },
			{ name: 'Battery On/Off Switch', why: 'In the battery’s + wire and rated 60 A or more, so the drone powers up and down without unplugging.' },
			{ name: 'Matek BEC12S-PRO', why: 'Its own 5 V, 5 A supply for the Pi 4, camera and 4G modem, so they can never brown out the flight controller. Recommended by a professional drone builder in Vietnam.', price: 550_000 },
			{ name: 'LiPo Balance Charger', why: 'HotRC A400 for safely charging 2S–3S packs between flights.', price: 200_000 },
		],
	},
	{
		id: 'control',
		title: 'Flight control',
		icon: 'target',
		color: 'var(--chart-3)',
		parts: [
			{ name: 'MicoAir743 V2 (H743, 30×30)', why: 'The drone’s main flight brain, running INAV 9.1.', price: 1_500_000 },
			{ name: 'MicoAir IO Board', why: 'The power hub at the centre of the top plate: feeds the four ESCs and the flight controller.' },
			{ name: 'Microzone MC6C Radio + MC7RE V2 Receiver', why: 'To steer the drone manually with minimal lag.', price: 600_000 },
			{ name: 'Buzzer + LiPo Alarm', why: 'Beeps when the battery runs low, since this build has no on-screen display.', price: 55_000 },
		],
	},
	{
		id: 'video',
		title: 'Video & 4G',
		icon: 'video-camera',
		color: 'var(--chart-4)',
		parts: [
			{ name: 'Raspberry Pi 4 (4 GB)', why: 'Streams the video over 4G, reads flight data from the flight controller over USB and serves the live dashboard.', price: 3_600_000 },
			{ name: 'Raspberry Pi Camera Module 3', why: '12 MP autofocus camera that plugs straight into the Pi with a ribbon and streams 720p at 60 fps.', price: 864_000 },
			{ name: 'Printed Camera Tilt Mount', why: 'PETG case and hinge under the front of the frame: tilts the camera from 0 to 45° down. Includes its screws.', price: 130_000 },
			{ name: 'ZTE MF833 4G Modem', why: 'The USB 4G stick that gives the drone internet.', price: 780_000 },
		],
	},
];

/**
 * The drone page intro (src/components/DroneSplash.astro): the on-screen display over the drone's live camera view.
 * The timecode, link, speed and altitude numbers tick by themselves (src/scripts/drone-splash.ts).
 */
export const droneIntro = {
	camera: 'CAM 1',
	video: '1080P30',
	network: '4G',
	/** "LINK: WEAK" while the 4G link connects, then "LINK: GOOD". */
	link: 'LINK:',
	linkWeak: 'WEAK',
	linkGood: 'GOOD',
	/** The 3S LiPo: cells, per-cell voltage, pack voltage and charge. */
	cells: '3S',
	cellVoltage: 'CELL 3.90V',
	packVoltage: '11.7V',
	charge: '78%',
};

/** Earlier drone work, kept for the record. */
export const earlierWork = {
	title: 'Flight controller experiments',
	date: 'May 2025',
	summary:
		'Before this build, we wrote a lightweight flight stack on an STM32 microcontroller to learn how drones stay in the air.',
	points: [
		'Complementary filter for attitude estimation from an MPU-9250 IMU',
		'Cascaded PID controller, tuned with systematic sweeps and logging',
		'Failsafe state machine for low battery and signal loss',
		'Stable hover within ±0.3 m altitude and sub-degree attitude RMS',
	],
};
