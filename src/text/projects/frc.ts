/**
 * FIRST ROBOTICS PAGE TEXT (/work/frc/), from top to bottom.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - The page's intro sentence, card title and main photo: src/text/projects/frc.md
 *   - Team info, the 2027 and 2026 seasons, and the hardware lists: further down this file
 *   - Labels inside the 3D robot ("Intake rollers"...): src/lib/three/models/frc-robot.ts
 */

/** Top of the page, the photo scroll scene and the 3D robot. */
export const frcPage = {
	seoTitle: 'FIRST Robotics | JPL Innovation',
	logoCaption: 'Saigon South Dragons · FIRST Robotics Competition',
	logoAlt: 'Team 10951 Saigon South Dragons logo',
	/** The big heading is "Team" + the team number. */
	headingPrefix: 'Team',
	/** The four facts under the intro. Rookie year and region come from `team` below. */
	facts: {
		rookieYear: 'Rookie year',
		region: 'Region',
		homeLabel: 'Home',
		home: 'SSIS, Ho Chi Minh City',
		nextSeasonLabel: 'Next season',
		nextSeason: '2027',
	},
	/** Words that appear over the robot photo as you scroll. */
	reveal: {
		heading: 'Designed, built and programmed by students.',
		text: 'Our 2026 rookie robot: 140 lb, 12 ft/s, and tuned until its autonomous routine worked 95% of the time.',
		highlights: ['Six-wheel traction drivebase', 'Dual-flywheel shooter, 25°–65° hood', 'Pneumatic climb', 'Java, WPILib and OpenCV vision'],
	},
	model3d: {
		heading: 'The 2026 robot in 3D',
		text: 'The official 2026 KitBot with our changes. Follow a ball of FUEL: the intake pulls it off the floor into the clear hopper, the feeder lifts it into the launcher, and the hood sends it up and forward toward the goal. On a computer you can drag to look around.',
		note: 'A simplified model for illustration, not our CAD.',
		/** Read aloud by screen readers instead of the 3D model. */
		description:
			"3D model of Team 10951's 2026 robot, based on the official KitBot: aluminium frame, red star-wheel intake, a blue and green feeder, a banded launcher roller under a white, blue and black hood that sends FUEL up and forward, Kraken X60 motors, a Limelight camera, a red signal light and a clear rear hopper with the 10951 Saigon South Dragons decal.",
		fallbackAlt: "Team 10951's 2026 robot",
	},
	/** "About Team 10951" near the bottom. The sentence under it is built from `team` below. */
	about: {
		headingPrefix: 'About Team',
		leadershipHeading: 'Team leadership',
		leadershipIntro: "Mechanical and electrical are led by JPL Innovation's CEO and COO.",
	},
};

/** Headings and buttons in the season switcher (2027 / 2026 tabs). The season content itself is further down. */
export const seasonsText = {
	chooseSeason: 'Choose a season',
	s2027: {
		liveTag: 'Preseason in progress',
		joinButton: 'Join or sponsor us',
		joinEmailSubject: 'FRC 2027: joining or sponsoring',
		lookBackButton: 'Look back at 2026',
		roadHeading: 'Road to 2027',
		nowTag: 'Now',
		focusHeading: "What we're building toward",
		focusIntro: 'Carried forward from our rookie year.',
	},
	s2026: {
		/** The quick links at the top of the 2026 tab. */
		sectionLinks: { game: 'Game', timeline: 'Timeline', robot: 'Robot', results: 'Results' },
		gameHeading: 'The 2026 game: precision scoring',
		seasonLabel: 'Competition season:',
		fieldAlt: 'Official 2026 FRC playing field layout',
		fieldOpenLabel: 'Open the 2026 playing field image full size',
		fieldCaption: 'Official 2026 playing field',
		matchHeading: 'Match structure',
		matchLength: '2:30 per match',
		scoringHeading: 'Points per scoring action',
		timelineHeading: 'From kickoff to competition',
		robotHeading: 'Built for reliability',
		photosLabel: 'Photos of our 2026 KitBot',
		testingHeading: 'Performance in testing',
		resultsHeading: 'What our rookie season delivered',
		goalsHeading: 'Goals',
	},
};

/** The "Hardware we use" section. The motors and devices themselves are the lists at the bottom of this file. */
export const hardwareText = {
	heading: 'Hardware we use',
	intro: 'The stack: the motors that move the robot, the CAN control system that drives them, and the camera that sees the field.',
	motorsHeading: 'Motors',
	legacyHeading: 'Legacy motors',
	legacySummary: 'Falcon 500, CIM / Mini CIM',
	hide: 'Hide',
	controlHeading: 'Control & electronics',
	controllerChip: 'roboRIO',
	controllerNote: ['2026 only', 'then SystemCore'],
	busCaption:
		'One two-wire bus back to the robot controller: the roboRIO for the 2026 season, SystemCore after that. Every device on it has its own CAN ID.',
	visionHeading: 'Vision',
};

export const team = {
	number: 10951,
	name: 'Saigon South Dragons',
	/** Team logo (dragon and gear). The image has photo corners; show it cropped to a circle. */
	logo: '/assets/10951.jpg',
	school: 'Saigon South International School (SSIS)',
	rookieYear: 2026,
	region: 'Asia-Pacific',
	mission: 'Engineering excellence through competitive robotics',
	focus: [
		{ icon: 'cpu', title: 'Mechanical Engineering', desc: 'CAD design, fabrication, mechanisms' },
		{ icon: 'terminal-window', title: 'Control Systems', desc: 'Autonomous programming, real-time control' },
		{ icon: 'calendar', title: 'Project Management', desc: 'Timeline coordination, resource allocation' },
		{ icon: 'users', title: 'STEM Education', desc: 'Student mentorship and technical development' },
	],
} as const;

/* ------------------------------------------------------------------ */
/* 2027 — coming soon                                                  */
/* ------------------------------------------------------------------ */

export const season2027 = {
	year: 2027,
	status: 'Coming soon',
	headline: 'Season two is loading…',
	intro:
		'Our second season begins when FIRST reveals the 2027 game at Kickoff in January. Until then, we are turning everything we learned as rookies into a faster, more reliable team.',
	timeline: [
		{
			when: 'Sep – Dec 2026',
			title: 'Preseason',
			desc: 'Recruitment, skill workshops, CAD and programming training, and prototyping practice.',
			state: 'current',
		},
		{
			when: 'January 2027',
			title: 'Kickoff & game reveal',
			desc: 'The 2027 game is announced. Date to be confirmed by FIRST.',
			state: 'upcoming',
		},
		{
			when: 'Jan – Feb 2027',
			title: 'Design & build',
			desc: 'Strategy, CAD, prototyping, fabrication, and wiring.',
			state: 'upcoming',
		},
		{
			when: 'Spring 2027',
			title: 'Competitions',
			desc: 'Regional events to be announced.',
			state: 'upcoming',
		},
	],
	/** What we're carrying forward from our rookie year. */
	focus: [
		{ icon: 'target', title: 'Vision targeting', desc: 'Advanced vision processing for dynamic, on-the-move targeting.' },
		{ icon: 'lightning', title: 'Reliable mechanisms', desc: 'Mechanisms and pneumatics that hold up under sustained load.' },
		{ icon: 'terminal-window', title: 'Autonomous from day one', desc: 'Workshops on autonomous programming so every programmer can contribute.' },
		{ icon: 'pencil-line', title: 'Documentation', desc: 'Every subsystem documented, with CAD tutorials and build guides for rookies.' },
		{ icon: 'check-circle', title: 'Maintenance SOPs', desc: 'Standard operating procedures that keep the robot competition-ready.' },
		{ icon: 'users', title: 'Grow the team', desc: 'Recruit and train new members across mechanical, electrical, and software.' },
	],
} as const;

/* ------------------------------------------------------------------ */
/* 2026 — rookie season                                                */
/* ------------------------------------------------------------------ */

export const season2026 = {
	year: 2026,
	status: 'Rookie season',
	game: {
		summary:
			'The 2026 challenge centered on precision game piece scoring. Two alliances of three robots each competed head-to-head to collect game pieces from the field and score them into alliance goals across multiple difficulty levels.',
		season: 'January – April 2026',
		fieldImage: '/assets/2026-playing-field-page.webp',
		/** Match phases; `seconds` drives the proportional match bar. Teleop's 2:15 includes the endgame. */
		phases: [
			{ name: 'Autonomous', time: '0:15', seconds: 15, desc: 'Pre-programmed instructions only — driver control disabled. Bonus points for autonomous scoring.' },
			{ name: 'Teleoperated', time: '1:45', seconds: 105, desc: 'Drivers control the robots to score game pieces and execute strategy.' },
			{ name: 'Endgame', time: '0:30', seconds: 30, desc: 'The final 30 seconds of teleop: climb, dock, or park for bonus points.' },
		],
		scoring: [
			{ method: 'High Goal Scoring', points: '5–8', max: 8, note: 'Precision required' },
			{ method: 'Low Goal Scoring', points: '2–3', max: 3, note: 'More accessible' },
			{ method: 'Autonomous Bonus', points: '+3', max: 3, note: 'Reliability-focused' },
			{ method: 'Parking', points: '5', max: 5, note: 'Position-based' },
			{ method: 'Low Climb', points: '10', max: 10, note: 'Mechanical challenge' },
			{ method: 'High Climb', points: '20', max: 20, note: 'Elite teams only' },
		],
		rankingPoints: 'Win: 2 RP · Tie: 1 RP · Loss: 0 RP · Bonus RP for completing advanced objectives',
	},
	timeline: [
		{ when: 'Sep – Dec 2025', title: 'Preseason', desc: 'Team recruitment, skill workshops, prototyping exercises, competition preparation.' },
		{ when: 'Jan 4, 2026', title: 'Kickoff & game release', desc: 'Official game reveal. Analyzed the manual, identified strategies, began design concepts.' },
		{ when: 'Jan 5 – 18', title: 'Design & prototyping', desc: 'CAD modeling, mechanism prototyping, intake and shooter design validation.' },
		{ when: 'Jan 19 – Feb 8', title: 'Build phase', desc: 'Full robot fabrication, electrical assembly, initial software development.' },
		{ when: 'Feb 12 – Mar 1', title: 'Testing & programming', desc: 'Fine-tuned the shooter to 95% repeatability, validated autonomous, prepared for competition.' },
		{ when: 'Mar 2 – 8', title: 'Vancouver Regional', desc: 'First regional competition, in Vancouver, Canada.' },
		{ when: 'Mar 30 – Apr 5', title: 'Istanbul Regional', desc: 'Second regional competition, in Istanbul, Turkey.' },
	],
	robot: {
		/** Photos of the 2026 robot (a modified KitBot). The first is shown large; w/h are the files' pixel sizes. */
		photos: [
			{
				src: '/assets/FRCnew.jpg',
				w: 2000,
				h: 1333,
				alt: "Team 10951's 2026 KitBot from the front: red star-wheel intake, blue and green feeder, and the white, blue and black launcher hood, with the team's practice goal behind it.",
				caption: 'Front: intake, feeder and launcher hood',
			},
			{
				src: '/assets/kitbot-back.jpg',
				w: 1000,
				h: 1501,
				alt: 'The robot from the back: the clear hopper with the 10951 Saigon South Dragons decal, the banded launcher roller and the feeder.',
				caption: 'Back: the clear hopper and our decal',
			},
			{
				src: '/assets/FRC.JPG',
				w: 2000,
				h: 1333,
				alt: "Our 2026 robot on the team's practice field among yellow FUEL balls, in front of the wooden practice goal.",
				caption: 'Testing on our practice field',
			},
		],
		philosophy:
			'Reliability first. A robot that scores 80% reliably beats one that scores 95% once and fails the next.',
		stats: [
			{ value: 140, suffix: ' lb', label: 'Total mass' },
			{ value: 12, suffix: ' ft/s', label: 'Top speed' },
			{ value: 180, suffix: ' lb', label: 'Pushing force' },
			{ value: 2.3, suffix: ' s', label: 'Avg. cycle time' },
		],
		specs: [
			{
				icon: 'cpu',
				title: 'Drivebase',
				items: [
					'6-wheel traction layout with brushed gearboxes',
					'Staggered center wheel for precise control',
					'Encoder-based odometry with IMU sensor fusion',
					'0–12 ft/s in 1.2 s',
				],
			},
			{
				icon: 'lightning',
				title: 'Power',
				items: [
					'REV Robotics 40A PDP with integrated breakers',
					'120A battery system with active balancing',
					'Pneumatic compressor for climbing mechanisms',
					'Distributed power to all subsystems',
				],
			},
			{
				icon: 'target',
				title: 'Subsystems',
				items: [
					'Intake: motorized dual-stage roller with game piece detection',
					'Shooter: dual flywheel, adjustable 25°–65° hood',
					'Climb: pneumatic-actuated arms with passive ratchet',
				],
			},
			{
				icon: 'terminal-window',
				title: 'Software',
				items: ['Java / WPILib', 'OpenCV vision', 'PathPlanner autonomous', '±1° angle calibration'],
			},
		],
		metrics: [
			{ label: 'Autonomous repeatability', value: 95, detail: 'over 50+ trials' },
			{ label: 'Low goal accuracy', value: 92, detail: 'in testing' },
			{ label: 'High goal accuracy', value: 78, detail: 'from mid-field' },
		],
	},
	achievements: [
		{ title: 'Autonomous mastery', desc: 'Developed a reliable autonomous system with 95% consistency.' },
		{ title: 'Shooter precision', desc: 'Achieved high accuracy in high-pressure testing.' },
		{ title: 'Team synergy', desc: 'Built strong collaboration between mechanical, electrical, and software.' },
		{ title: 'Timeline management', desc: 'Kept an aggressive build schedule without compromising quality.' },
	],
	competitions: [
		{
			code: 'CAN',
			city: 'Vancouver, Canada',
			name: 'Vancouver Regional',
			dates: 'March 2 – 8, 2026',
			goals: ['Target: top 16 in qualification matches', 'Prove autonomous reliability', 'Collect data for strategy refinement'],
		},
		{
			code: 'TUR',
			city: 'Istanbul, Türkiye',
			name: 'Istanbul Regional',
			dates: 'March 30 – April 5, 2026',
			goals: ['Target: top 8 with playoff progression', 'Consistent alliance scoring', 'Scout strong partners for alliance selection'],
		},
	],
} as const;

/* ------------------------------------------------------------------ */
/* Hardware we use — motors and the CAN control stack                  */
/* Specs as supplied by the team; nothing here is estimated.           */
/* ------------------------------------------------------------------ */

export interface HardwareItem {
	name: string;
	maker: string;
	desc: string;
	/** Spec chips: a value with an optional short label, e.g. { value: "6,000 RPM", label: "free speed" }. */
	specs: Array<{ value: string; label?: string }>;
	/** Older hardware kept for context. */
	legacy?: boolean;
}

export const motors: HardwareItem[] = [
	{
		name: 'Kraken X60',
		maker: 'CTRE',
		desc: 'Powered by Talon FX: the motor and its controller in one unit.',
		specs: [
			{ value: '6,000 RPM', label: 'free speed' },
			{ value: '1,100+ W', label: 'peak power' },
			{ value: '~7+ N·m', label: 'stall torque' },
			{ value: 'Integrated Talon FX' },
			{ value: 'SplineXS shaft' },
			{ value: 'High-res encoder' },
		],
	},
	{
		name: 'Kraken X44',
		maker: 'CTRE',
		desc: 'The compact X60, used where space and weight matter more than raw output.',
		specs: [{ value: 'Integrated Talon FX' }, { value: 'SplineXS shaft family' }, { value: 'Compact' }],
	},
	{
		name: 'NEO',
		maker: 'REV Robotics',
		desc: 'Brushless drop-in replacement for CIM-style motors, paired with a SPARK MAX controller.',
		specs: [
			{ value: '5,676 RPM', label: 'free speed' },
			{ value: '2.6 N·m', label: 'stall torque' },
			{ value: '406 W', label: 'peak output' },
			{ value: 'SPARK MAX' },
		],
	},
	{
		name: 'NEO Vortex',
		maker: 'REV Robotics',
		desc: 'Integrated controller and a through-bore hex shaft for quick-change mounting.',
		specs: [
			{ value: '6,784 RPM', label: 'free speed' },
			{ value: '3.6 N·m', label: 'stall torque' },
			{ value: '640 W', label: 'peak output' },
			{ value: 'Through-bore hex' },
		],
	},
	{
		name: 'Falcon 500',
		maker: 'CTRE',
		desc: 'The brushless motor that established the integrated Talon FX pattern before the Kraken line. Still widely used.',
		specs: [{ value: 'Integrated Talon FX' }, { value: 'Brushless' }],
		legacy: true,
	},
	{
		name: 'CIM / Mini CIM',
		maker: 'Classic',
		desc: 'The brushed DC drivetrain motors most teams started on before brushless motors became legal and common.',
		specs: [{ value: 'Brushed DC' }, { value: 'Drivetrain' }],
		legacy: true,
	},
];

export const controlStack: HardwareItem[] = [
	{
		name: 'roboRIO → SystemCore',
		maker: 'Robot controller',
		desc: 'The roboRIO runs the robot for the 2026 season only. After that it is replaced by SystemCore, the new FRC robot controller.',
		specs: [
			{ value: 'roboRIO', label: '2026 season only' },
			{ value: 'SystemCore', label: 'replaces it after 2026' },
		],
	},
	{
		name: 'CAN bus',
		maker: 'Wiring',
		desc: 'Every motor controller and sensor shares one two-wire bus back to the robot controller: the roboRIO in 2026, SystemCore after that.',
		specs: [{ value: 'Two-wire' }, { value: 'Unique CAN ID per device' }],
	},
	{
		name: 'Talon FX / Talon FXS',
		maker: 'CTRE',
		desc: 'Talon FX is built into Kraken and Falcon motors; Talon FXS is a standalone controller for third-party or brushed motors.',
		specs: [{ value: 'Integrated (FX)' }, { value: 'Standalone (FXS)' }],
	},
	{
		name: 'CANcoder',
		maker: 'CTRE',
		desc: 'Absolute magnetic encoder for precise rotational position, such as swerve module steering.',
		specs: [{ value: 'Absolute' }, { value: 'Magnetic' }],
	},
	{
		name: 'Pigeon 2.0',
		maker: 'CTRE',
		desc: 'IMU used for the robot’s heading and orientation.',
		specs: [{ value: '9-axis IMU' }],
	},
	{
		name: 'CANivore',
		maker: 'CTRE',
		desc: 'CAN FD adapter with more bandwidth and more reliable timing for larger CAN networks.',
		specs: [{ value: 'CAN FD' }],
	},
	{
		name: 'CANdi · CANrange · CANdle',
		maker: 'CTRE',
		desc: 'Signal interface, time-of-flight proximity sensing, and addressable LED control, all on the same bus.',
		specs: [{ value: 'Signal I/O' }, { value: 'Time-of-flight' }, { value: 'Addressable LEDs' }],
	},
	{
		name: 'PDP / PDH',
		maker: 'Power',
		desc: 'The Power Distribution Panel or Hub routes and breaker-protects power to every motor controller.',
		specs: [{ value: 'Breaker-protected' }],
	},
	{
		name: 'Phoenix Tuner X',
		maker: 'CTRE',
		desc: 'Desktop app for configuring, flashing firmware, and live-diagnosing every device above.',
		specs: [{ value: 'Config' }, { value: 'Firmware' }, { value: 'Live diagnostics' }],
	},
];

/** Vision: cameras that see the field. */
export const vision: HardwareItem[] = [
	{
		name: 'Limelight',
		maker: 'Limelight Vision',
		desc: 'Smart camera for live video and on-board vision processing, so the robot can see the field.',
		specs: [{ value: 'Live video' }, { value: 'Vision processing' }],
	},
];
