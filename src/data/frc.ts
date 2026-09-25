/**
 * Content for the FIRST Robotics page (src/pages/work/frc.astro).
 * Edit the text here — the page layout picks it up automatically.
 */

export const team = {
	number: 10951,
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
		name: 'CAN bus',
		maker: 'Wiring',
		desc: 'Every motor controller and sensor shares one two-wire bus back to the roboRIO.',
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
