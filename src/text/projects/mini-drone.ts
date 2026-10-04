/**
 * MINI ARDUINO DRONE PAGE TEXT (/work/mini-drone/), from top to bottom.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - The card title, description and picture on the Work page: src/text/projects/mini-drone.md
 *   - Prices are estimates in VND. Leave `price` out for parts that aren't priced yet; the totals add up by themselves.
 */

/** Headings and small labels on the page. The content (facts, steps, parts...) is further down. */
export const miniDronePage = {
	heroImgAlt: 'Illustration of the mini Arduino quadcopter, a small four-motor radio-controlled frame',
	progressHeading: 'From bill of materials to first flight',
	stepLabel: 'Step',
	doneTag: 'Done',
	nowTag: 'Now',
	systemsHeading: 'Two systems, one tiny quad',
	systemsIntro: 'How the hand-built transmitter talks to the drone, and how that drone drives its four motors.',
	/** Before a branch in a system diagram: "Also from the flight controller". */
	branchPrefix: 'Also from the',
	/** The parts heading is "<number> parts, one tiny quad". */
	partsHeadingSuffix: 'parts, one tiny quad',
	/** Screen-reader table caption: "<group> parts". Column headings are shared: src/components/parts-table.tsx */
	tableCaptionSuffix: 'parts',
};

export interface Part {
	name: string;
	why: string;
	price?: number;
}

export interface PartGroup {
	id: string;
	title: string;
	icon: 'rocket-launch' | 'lightning' | 'cell-signal' | 'cpu';
	/** A chart token (validated categorical order), used for the group marker. */
	color: string;
	parts: Part[];
}

export const miniDrone = {
	name: 'Mini Arduino Drone',
	status: 'Concept',
	intro:
		'A palm-sized quadcopter driven by an Arduino Pro Mini (ATmega328P) flight controller, flown over a custom 2.4GHz NRF24L01 radio link from a hand-built transmitter — built to learn motor control, IMU stabilisation and a from-scratch RC protocol.',
	/** Who's building it. `members` are ids from src/text/members/*.md; leave a role's `member` out to show the name only. */
	team: [{ role: 'Design, build & flight software', member: 'khoa' }],
	facts: [
		{ icon: 'rocket-launch', label: 'Frame', value: '69 mm micro' },
		{ icon: 'cpu', label: 'Flight controller', value: 'ATmega328P' },
		{ icon: 'lightning', label: 'Motors', value: '4× 615/716 brushed' },
		{ icon: 'cell-signal', label: 'Radio link', value: '2.4GHz NRF24L01' },
	],
} as const;

export const roadmap = [
	{ title: 'Design & BOM', desc: 'Frame, flight controller and radio link chosen.', state: 'done' },
	{ title: 'Transmitter build', desc: 'Arduino Nano, joysticks and the LCD readout.', state: 'current' },
	{ title: 'Drone wiring', desc: 'MOSFET motor drivers, IMU and the flight controller.', state: 'upcoming' },
	{ title: 'Firmware & tuning', desc: 'Stabilisation loop and radio binding.', state: 'upcoming' },
	{ title: 'First flight', desc: 'Bench motor tests, then a first hover.', state: 'upcoming' },
] as const;

/** How the parts connect. `link` labels the connection *into* that step. */
export const systems = [
	{
		title: 'Radio & control',
		icon: 'cell-signal',
		steps: [
			{ name: 'Joysticks', detail: 'on the transmitter' },
			{ name: 'Arduino Nano', detail: 'transmitter MCU' },
			{ name: 'NRF24L01+PA+LNA', detail: 'long-range radio', link: '2.4 GHz' },
			{ name: 'NRF24L01', detail: 'on the drone', link: '2.4 GHz' },
			{ name: 'Arduino Pro Mini', detail: 'flight controller' },
		],
		branch: {
			from: 'Arduino Pro Mini',
			steps: [{ name: 'MPU-6050', detail: 'IMU feedback' }],
		},
	},
	{
		title: 'Power',
		icon: 'lightning',
		steps: [
			{ name: '1S LiPo', detail: '200–300 mAh' },
			{ name: '4× SI2300 MOSFET', detail: 'motor drivers' },
			{ name: '4× Coreless motor', detail: '615/716, 2 CW + 2 CCW' },
		],
	},
] as const;

export const partGroups: PartGroup[] = [
	{
		id: 'drone',
		title: 'Drone: frame & flight controller',
		icon: 'rocket-launch',
		color: 'var(--chart-1)',
		parts: [
			{ name: '3D Printed Micro Frame', why: '69 mm motor-to-motor, sized for the coreless motors.' },
			{ name: 'Arduino Pro Mini (ATmega328P)', why: 'Runs the stabilisation loop and reads the radio link.' },
			{ name: 'MPU-6050 IMU', why: '6-axis accelerometer and gyroscope for attitude stabilisation.' },
			{ name: 'NRF24L01 / NRF24L01+ (SMD mini)', why: "Receives the transmitter's 2.4GHz commands." },
			{ name: '4× 615/716 Coreless Motors', why: 'Small brushed motors sized for a micro frame, 2 CW and 2 CCW.' },
			{ name: '4× 31–40 mm Propellers', why: 'Matched to the coreless motors, 2 CW and 2 CCW.' },
			{ name: '4× SI2300 MOSFETs', why: 'Switch motor power from the flight controller’s logic-level pins.' },
			{ name: '4× 1N4148 Flyback Diodes', why: 'Protect each MOSFET from the motor’s back-EMF.' },
			{ name: '4× 10kΩ Pull-down Resistors', why: 'Hold each MOSFET gate low when the pin isn’t driving it.' },
			{ name: '1S 3.7V LiPo Battery (200–300 mAh, ≥30C)', why: 'Light enough for a micro quad, with enough discharge rate for 4 motors.' },
			{ name: 'JST-PH 2.0 & 30 AWG Wire', why: 'Battery connector and the fine wire a micro build needs.' },
		],
	},
	{
		id: 'transmitter',
		title: "Transmitter",
		icon: 'cell-signal',
		color: 'var(--chart-3)',
		parts: [
			{ name: 'Arduino Nano (ATmega328P)', why: 'Reads the joysticks and drives the radio and LCD.' },
			{ name: 'NRF24L01+PA+LNA', why: 'External-antenna radio module for better range than the drone’s onboard one.' },
			{ name: '2× Analog Joystick Module', why: 'Dual-axis gimbals for the flight sticks.' },
			{ name: '16x2 LCD + I2C Backpack (PCF8574)', why: 'Shows link and battery status on the transmitter.' },
			{ name: '7.4V 2S LiPo or 2× 18650', why: "Powers the transmitter's electronics and radio module." },
			{ name: '3D Printed Case', why: 'Houses the sticks, LCD and electronics.' },
		],
	},
];

/** Project files (schematics, firmware) kept outside the repo. */
export const projectFiles = {
	label: 'Project files',
	note: 'Schematics and firmware for the drone and the transmitter.',
	href: 'https://drive.google.com/drive/folders/1mWTCPN2daOcmTa4wUF0j8qPXhXvxLfkK',
};
