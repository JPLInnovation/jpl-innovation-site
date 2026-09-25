/**
 * Content for the drone page (src/pages/work/drone.astro).
 * Prices are estimates in VND. Leave `price` out for parts that aren't priced yet.
 */

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
	facts: [
		{ icon: 'rocket-launch', label: 'Frame', value: 'F450 · 450 mm' },
		{ icon: 'lightning', label: 'Battery', value: '3S 2200 mAh' },
		{ icon: 'cell-signal', label: 'Video link', value: '4G LTE' },
		{ icon: 'target', label: 'Props', value: '10 × 4.5″' },
	],
} as const;

export const roadmap = [
	{ title: 'Design & parts list', desc: 'Components chosen and budgeted.', state: 'done' },
	{ title: 'Sourcing parts', desc: 'Ordering components.', state: 'current' },
	{ title: 'Frame & power assembly', desc: 'Motors, ESCs, PDB, and wiring on the F450.', state: 'upcoming' },
	{ title: 'Flight controller setup', desc: 'Calibration, radio binding, and first hover.', state: 'upcoming' },
	{ title: '4G video link', desc: 'Pi Zero 2 W streaming Camera Module 3 over 4G.', state: 'upcoming' },
	{ title: 'Field testing', desc: 'Test flights and tuning.', state: 'upcoming' },
] as const;

/** How the parts connect. `link` labels the connection *into* that step. */
export const systems = [
	{
		title: 'Power',
		icon: 'lightning',
		steps: [
			{ name: '3S LiPo', detail: '2200 mAh' },
			{ name: 'PDB', detail: 'MicoAir' },
			{ name: '4× ESC', detail: '30 A' },
			{ name: '4× Motors', detail: '2212 brushless' },
		],
		branch: {
			from: 'PDB',
			steps: [
				{ name: '5V BEC', detail: 'dedicated supply' },
				{ name: 'Pi Zero 2 W', detail: '+ 4G modem' },
			],
		},
	},
	{
		title: 'Flight control',
		icon: 'target',
		steps: [
			{ name: 'MC6C radio', detail: 'pilot’s transmitter' },
			{ name: 'Receiver', detail: 'on the drone', link: '2.4 GHz' },
			{ name: 'MicoAir H743', detail: 'flight controller' },
			{ name: '4× ESC', detail: 'motor speed' },
		],
	},
	{
		title: 'Live video',
		icon: 'video-camera',
		steps: [
			{ name: 'Camera Module 3', detail: 'autofocus' },
			{ name: 'Pi Zero 2 W', detail: 'encode & stream', link: 'camera cable' },
			{ name: '4G modem', detail: 'ZTE MF833', link: 'OTG USB' },
			{ name: 'Viewer', detail: 'anywhere online', link: 'mobile network' },
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
			{ name: 'F450 Drone Frame', why: 'A large, strong frame with plenty of room for all the electronics.', price: 180_000 },
			{ name: '4× 2212 Brushless Motors', why: 'The classic motors for the F450 frame — 2 clockwise, 2 counter-clockwise.', price: 142_000 },
			{ name: '4× 30A ESCs', why: 'Electronic speed controllers that drive the brushless motors.', price: 150_000 },
			{ name: '1045 Propellers', why: 'Big 10-inch propellers matched to the 2212 motors.', price: 40_000 },
			{ name: 'Anti-vibration Dampers', why: 'Small M2/M3 rubber mounts that isolate the flight controller from motor vibration.' },
		],
	},
	{
		id: 'power',
		title: 'Power',
		icon: 'lightning',
		color: 'var(--chart-2)',
		parts: [
			{ name: 'LiPo Battery 3S 2200 mAh', why: 'The power needed to lift this heavier rig.', price: 360_000 },
			{ name: 'MicoAir PDB', why: 'Power distribution board that connects the battery to the ESCs.' },
			{ name: '5V BEC', why: 'The flight controller’s onboard 5V regulator maxes out at 2 A — the Pi Zero and 4G modem together need their own supply.', price: 70_000 },
			{ name: 'LiPo Balance Charger', why: 'HotRC A400 for safely charging 2S–3S packs between flights.', price: 200_000 },
		],
	},
	{
		id: 'control',
		title: 'Flight control',
		icon: 'target',
		color: 'var(--chart-3)',
		parts: [
			{ name: 'MicoAir743 V2 (H743, 30×30)', why: 'The drone’s main flight brain.', price: 1_500_000 },
			{ name: 'Microzone MC6C Radio', why: 'To steer the drone manually with minimal lag.', price: 600_000 },
		],
	},
	{
		id: 'video',
		title: 'Video & 4G',
		icon: 'video-camera',
		color: 'var(--chart-4)',
		parts: [
			{ name: 'Raspberry Pi Zero 2 W', why: 'Processes and streams the video over 4G.', price: 850_000 },
			{ name: 'Camera Module 3', why: 'Crisp, high-quality video with fast autofocus.', price: 864_000 },
			{ name: 'Pi Zero Camera Cable', why: 'Adapts the camera to the Pi Zero’s smaller connector.', price: 50_000 },
			{ name: 'ZTE MF833 4G Modem', why: 'The USB 4G stick that gives the drone internet.', price: 780_000 },
			{ name: 'OTG Micro-USB Cable', why: 'Plugs the full-size 4G stick into the Pi Zero.', price: 15_000 },
		],
	},
];

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
