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
	/** Heading, sentence, note and screen reader description of the 3D robot that turns to each part as you scroll
	 *  (its part by part text: src/text/showcase/robot.ts). `fallbackAlt` describes the photo shown without 3D. */
	model3d: {
		heading: 'The KitBot platform in 3D',
		text: 'The standard KitBot platform our 2026 robot is built on. Follow a ball of FUEL: the intake rollers pull it off the floor into the hopper, the feeder pushes it into the launcher wheel, and the curved hood sends it up and out of the top. On a computer you can drag to look around.',
		note: 'The kit’s standard design, simplified: every part in place, without the fasteners and small holes. Our modified robot is not modelled yet.',
		/** Read aloud by screen readers instead of the 3D model. */
		description:
			"3D model of the standard KitBot platform our 2026 robot is built on: an aluminium frame on six wheels with blue 10951 bumpers, intake rollers with yellow spacers, a see-through sloped hopper, a feeder roller, a salmon launcher wheel under a curved hood, CIM motors driving it all through belts and gears, the battery, power hub and an orange signal light.",
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
		'We are in preseason. Our second season begins when FIRST reveals the 2027 game, BIOCORE presented by Haas, at Kickoff on January 9, 2027. Until then, we are turning everything we learned as rookies into a faster, more reliable team.',
	timeline: [
		{
			when: 'Sep – Dec 2026',
			title: 'Preseason',
			desc: 'Recruitment, skill workshops, CAD and programming training, and prototyping practice. We are also considering the 2026 game as our preseason build: recreating the top teams’ robots, two swerve-drive robots, one with a turret and one with a mass shooter.',
			state: 'current',
		},
		{
			when: 'Jan 9, 2027',
			title: 'Kickoff & game reveal',
			desc: 'FIRST reveals the 2027 game: BIOCORE presented by Haas.',
			state: 'upcoming',
		},
		{
			when: 'Jan – Feb 2027',
			title: 'Design & build',
			desc: 'Strategy, CAD, prototyping, fabrication, and wiring.',
			state: 'upcoming',
		},
		{
			// TODO: the Marmara Regional's venue and city, once confirmed (only "Türkiye" is known).
			when: 'Mar – Apr 2027',
			title: 'Competitions',
			desc: 'Hawaii Regional in Honolulu, March 18–21. Marmara Regional in Türkiye, April 2–4.',
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
		{ when: 'Mar 4 – 7', title: 'Canadian Pacific Regional', desc: 'Our first regional, at the Pacific Coliseum in Vancouver, Canada.' },
		{ when: 'Mar 31 – Apr 2', title: 'Avrasya Regional', desc: 'Our second regional, in Istanbul, Türkiye.' },
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
	/**
	 * Both regionals and their official results (FIRST: frc-events.firstinspires.org/2026/team/10951). `km`: the
	 * great-circle distance from Ho Chi Minh City, city centre to city centre. `playoffs`: our alliance's playoff
	 * matches in order, our score first. `photo`: an id in `frcPhotos` below.
	 */
	competitions: [
		{
			code: 'CAN',
			key: 'van',
			tab: 'Vancouver',
			city: 'Vancouver, Canada',
			name: 'Canadian Pacific Regional',
			venue: 'Pacific Coliseum',
			dates: 'March 4 – 7, 2026',
			rank: 19,
			of: 44,
			qual: '5-5-0',
			overall: '6-7-0',
			alliance: 6,
			playoffs: [
				{ us: 220, them: 255 },
				{ us: 182, them: 145 },
				{ us: 159, them: 174 },
			],
			km: 11760,
			note: 'Our first FRC event. Alliance 6’s captain chose 10951 with its first pick.',
			photo: 'ev-van',
			goals: ['Target: top 16 in qualification matches', 'Prove autonomous reliability', 'Collect data for strategy refinement'],
		},
		{
			code: 'TUR',
			key: 'ist',
			tab: 'Istanbul',
			city: 'Istanbul, Türkiye',
			name: 'Avrasya Regional',
			venue: 'Istanbul',
			dates: 'March 31 – April 2, 2026',
			rank: 16,
			of: 40,
			qual: '4-5-0',
			overall: '5-7-0',
			alliance: 4,
			playoffs: [
				{ us: 109, them: 118 },
				{ us: 91, them: 26 },
				{ us: 148, them: 167 },
			],
			km: 8188,
			note: 'Three places higher than in Vancouver. Alliance 4’s captain chose 10951 with its first pick.',
			photo: 'ev-ist',
			goals: ['Target: top 8 with playoff progression', 'Consistent alliance scoring', 'Scout strong partners for alliance selection'],
		},
	],
} as const;

/* ------------------------------------------------------------------ */
/* The team's photos and stories (from the team's own season page)     */
/* ------------------------------------------------------------------ */

/** A team photo: public/assets/frc/<id>.webp (and <id>-640.webp). w/h: the file's pixel size. */
export interface FrcPhoto {
	id: string;
	w: number;
	h: number;
	/** Shown under the photo. */
	caption: string;
	/** Where and when, in small type. */
	meta?: string;
	/** Read aloud instead of the photo. */
	alt: string;
}

const p = (id: string, w: number, h: number, caption: string, alt: string, meta?: string): FrcPhoto => ({ id, w, h, caption, alt, meta });

export const frcPhotos = {
	// The rookie season, at the two regionals.
	'ev-van': p('ev-van', 1400, 1050, 'In the pits', 'Team members in Saigon South Dragons jerseys working on the robot in the Vancouver pits', 'Canadian Pacific Regional · Vancouver'),
	'ev-ist': p('ev-ist', 1400, 1050, 'With the robot', 'The team with the 10951 robot and the Vietnamese flag in the Istanbul pits', 'Avrasya Regional · Istanbul'),
	h1: p('h1', 1200, 900, 'Ranked 16 of 40', 'The team around the 10951 robot under a Vietnamese flag in the Istanbul pits', 'Avrasya Regional · Istanbul'),
	h3: p('h3', 1100, 825, 'Our swerve chassis takes shape', 'A student kneeling on the workshop floor, working on the swerve chassis', 'Build season · SSIS workshop'),
	h4: p('h4', 1100, 825, 'Fixing it between matches', 'Students and a mentor repairing the robot in the Vancouver pits', 'In the pits · Vancouver'),
	team: p('team', 1800, 772, 'Season two starts here', 'The 2026–27 Saigon South Dragons in blue team shirts, gathered around the robot in the SSIS workshop', 'SSIS · September 2026'),
	// From the pits.
	g1: p('g1', 1400, 1050, 'Pit repairs between matches', 'Three team members working on the robot in the pits', 'Vancouver'),
	g5: p('g5', 1280, 960, 'Team 10951 under the Vietnamese flag', 'Six team members holding small Vietnamese flags in front of a large one', 'Istanbul'),
	g3: p('g3', 1400, 1050, 'Safety glasses on, hands on the build', 'Two team members in safety glasses working on the robot', 'Vancouver'),
	g4: p('g4', 676, 1200, 'The arena, with our flag in the stands', 'The lit competition field seen from the stands, a Vietnamese flag held up in front', 'Istanbul'),
	g2: p('g2', 1400, 1050, 'Under the robot on the pit floor', 'A mentor on hands and knees under the robot while a student checks a laptop', 'Vancouver'),
	g6: p('g6', 676, 1200, 'Robot on its cart, loaded with game pieces', 'The robot seen from above on the pit floor, its hopper full of yellow balls', 'Istanbul'),
	g7: p('g7', 1400, 1050, 'Field setup at the Pacific Coliseum', 'Volunteers setting up the field in the arena under two FIRST banners', 'Vancouver'),
	g8: p('g8', 1400, 1050, 'Departure day, on the way to Istanbul', 'The team in blue jerseys with their luggage at the airport', 'Istanbul'),
	g9: p('g9', 900, 1200, 'A morning off at the Basilica Cistern', 'The team among the lit columns of the Basilica Cistern', 'Istanbul'),
	g10: p('g10', 1400, 601, 'Season two begins', 'New and returning members in blue team shirts on the school stairs', 'SSIS · September 2026'),
	// The build season, Sept 2025 to Feb 2026.
	b0: p('b0', 1300, 558, 'The rookie team, first photo together', 'The rookie team and mentors on the school stairs', 'Sept 2025'),
	b1: p('b1', 1300, 558, 'Wiring the swerve chassis', 'The swerve chassis on a bench: four swerve modules, wiring and the control electronics', 'Week 1'),
	b2: p('b2', 1300, 975, 'Drivetrain assembly on the bench', 'Students assembling the drivetrain on a workbench', 'Week 3'),
	b3: p('b3', 1300, 975, 'Deliverables on the whiteboard', 'Students planning next to a whiteboard of deliverables, beside the chassis', 'Week 3'),
	b4: p('b4', 1300, 558, 'A mechanism prototype takes shape', 'The intake and launcher prototype on a workbench', 'Week 4'),
	b5: p('b5', 1300, 975, 'Many hands at the workbench', 'Students in blue school shirts working together at a crowded workbench', 'Week 4'),
	b6: p('b6', 825, 1100, 'Chassis work on the workshop floor', 'Three students sitting on the floor around the chassis', 'Week 4'),
	robot: p('robot', 1500, 1125, 'The swerve chassis', 'A student tightening a bolt on the swerve-drive chassis, with four swerve modules, wiring and a battery visible'),
	ws: p('ws', 1400, 1050, 'Glasses on', 'A student in safety glasses working on the robot’s drivetrain', 'Vancouver pits'),
	// The workshop.
	st0: p('st0', 1000, 750, 'Sketching mechanisms before CAD', 'A student sketching mechanisms on a whiteboard'),
	st1: p('st1', 750, 1000, 'Aluminum extrusion and a cut plate, ready to assemble', 'A hand holding aluminium extrusions over a cut plate on the workbench'),
	st2: p('st2', 1000, 750, 'Building the electrical board', 'Students wiring the electrical board'),
	st3: p('st3', 1000, 750, 'Code next to a bench power supply', 'A student programming at a laptop next to a bench power supply'),
	st4: p('st4', 1000, 750, 'Breaking down the game at kickoff', 'Students on the floor around large sheets of paper, analysing the game'),
	st5: p('st5', 1000, 750, 'Painting the team bumpers', 'Bumper lettering stencilled in red paint, with brushes and tape'),
	st6: p('st6', 1000, 750, 'Design review with a mentor', 'Students and a mentor reviewing a mechanism at a table'),
	// RoboKids.
	rk0: p('rk0', 1100, 472, 'RoboKids, first session of the fall', 'Young students building robots at a table with FRC volunteers'),
	rk5: p('rk5', 825, 1100, 'A RoboKids build up close', 'A small robot build, seen from above'),
	rk3: p('rk3', 1100, 825, 'Teams at work in the SSIS workshop', 'Groups at tables across the SSIS workshop'),
	rk4: p('rk4', 1100, 825, 'Coding and testing at the workstations', 'Children coding at the workshop’s workstations'),
	rk1: p('rk1', 1100, 472, 'FRC volunteers helping at each table', 'An FRC volunteer helping young students with their build'),
	rk2: p('rk2', 1100, 472, 'Testing on the practice field', 'Small robots tested on a practice field mat'),
} satisfies Record<string, FrcPhoto>;

export type FrcPhotoId = keyof typeof frcPhotos;

/** The stack of photos near the top of the page: drag or flick the top one away, tap one to see it large. */
export const frcDeck = {
	heading: 'Built in Vietnam. Raced on two continents.',
	text: 'Our rookie season took us to Vancouver and Istanbul, and at both regionals an alliance captain picked our robot first. Season two is already on the bench.',
	hint: 'Drag or flick a photo away · tap to enlarge',
	prev: 'Previous photo',
	next: 'Next photo',
	photos: ['h1', 'ev-van', 'h3', 'g5', 'h4', 'team'] as FrcPhotoId[],
};

/** The photo viewer's buttons. */
export const lightboxText = { close: 'Close', prev: 'Previous', next: 'Next', open: 'Open photo:' };

/** The 2026 tab: the two regionals as event sheets, the pits gallery, and the build season strips. */
export const rookieText = {
	sectionLink: 'Photos',
	eventsHeading: 'Two regionals. Two continents.',
	eventsIntro: 'Our first FRC season. We ranked higher in Istanbul than in Vancouver, and at both events an alliance captain picked our robot first.',
	eventsLabel: 'Choose a regional',
	rankLabel: 'Qualification rank',
	qualLabel: 'Qualification record (W-L-T)',
	overallLabel: 'With playoffs',
	allianceLabel: 'Alliance',
	allianceValue: 'first pick',
	kmLabel: 'From Ho Chi Minh City',
	kmNote: 'great-circle',
	fieldLabel: 'Teams in rank order',
	us: 'Us',
	playoffsHeading: 'Playoffs',
	playoffWin: 'Won',
	playoffLoss: 'Lost',
	goalsHeading: 'What we aimed for',
	sourceLink: 'Official results on FIRST',
	sourceHref: 'https://frc-events.firstinspires.org/2026/team/10951',
	pitsHeading: 'From the pits',
	pitsIntro: 'Two trips, two arenas, one robot.',
	pits: ['g1', 'g5', 'g3', 'g4', 'g2', 'g6', 'g7', 'g8', 'g9', 'g10'] as FrcPhotoId[],
	buildHeading: 'Build season, week by week',
	buildIntro: 'Sept 2025 to Feb 2026. Hover or tap a strip to open it.',
	build: ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'] as FrcPhotoId[],
	swerveHeading: 'The swerve we built',
	swerveText: 'Alongside the KitBot we competed with, we built a swerve-drive chassis: each of its four corners is a module that steers and drives on its own, so the robot can move in any direction while facing any direction. It didn’t compete in 2026. It is the drivebase for 2027.',
	swervePhoto: 'robot' as FrcPhotoId,
};

/** The 2027 tab: the next regional's countdown, both regionals, the season's goals, and the preseason week by week. */
export const season2027More = {
	nextLabel: 'Next event',
	untilLabel: 'Until day one',
	units: { d: 'days', h: 'hrs', m: 'min' },
	followLink: 'Follow it on The Blue Alliance',
	followHref: 'https://www.thebluealliance.com/team/10951',
	regionalsHeading: 'Season two. Higher bar.',
	regionalsIntro: 'Stronger engineering, competition travel planned early, and community impact we can measure.',
	/** `startsAt`: midnight local time on day one (Honolulu UTC-10, Türkiye UTC+3; neither changes its clocks). km: great-circle from Ho Chi Minh City; none until the city is known. */
	regionals: [
		{ label: 'Regional 1 · March', name: 'Hawaii Regional', city: 'Honolulu, Hawaii', dates: 'March 18–21, 2027', startsAt: '2027-03-18T00:00:00-10:00', km: 10133, desc: 'Travel coordinated with our advisors and the team captain to keep costs down.' },
		// TODO: the Marmara Regional's city (for its distance) and venue.
		{ label: 'Regional 2 · April', name: 'Marmara Regional', city: 'Türkiye', dates: 'April 2–4, 2027', startsAt: '2027-04-02T00:00:00+03:00', km: undefined, desc: 'A return to Türkiye after our rookie run in Istanbul.' },
	],
	goals: [
		{ label: 'Robot', title: 'Engineering', items: ['Build on the swerve-drive platform from our rookie season', 'Seven sub-teams working on reliability, design, programming and strategy'] },
		{ label: 'Impact', title: 'FIRST Impact Award', items: ['Document outreach, student leadership and partnerships for the submission', 'Grow RoboKids, EmpowerTech and FRC Core Labs'] },
		{ label: 'Metrics', title: 'What we track', items: ['Students reached and sessions held', 'Mentor hours', 'Robot technical milestones', 'Official competition results'] },
	],
	weeksHeading: 'Every week, on the record.',
	weeksIntro: 'Our media team posts a recap of every build week. Tap a photo to flip through the week.',
	weeksPhoto: 'Photo',
	instagramLabel: 'Follow @ssis_frc',
	instagramHref: 'https://www.instagram.com/ssis_frc/',
	/** Newest first. `photos`: how many photos the week has (public/assets/frc/w<week>-<n>.webp). */
	weeks: [
		{ week: 7, dates: 'Oct 26–30', photos: 3, text: 'Week 7 in the workshop: hands on the chassis, laptops open, mentors close by.' },
		{ week: 6, dates: 'Oct 19–22', photos: 4, text: 'Driver practice is back on the practice field, while the rest of the team keeps building. Also: a lot of nuts.' },
		{ week: 5, dates: 'Oct 5–8', photos: 3, text: 'CAD and electrical working side by side, plus a mentor check-in.' },
		{ week: 4, dates: 'Sept 28 – Oct 2', photos: 3, text: 'The rookie robot came out with its 10951 bumpers on, and new members got to work beside it.' },
		{ week: 3, dates: 'Sept 21–24', photos: 4, text: 'Sub-teams in full swing: CAD, electrical, programming, and a mechanical lesson on choosing the right material.' },
		{ week: 2, dates: 'Sept 14–18', photos: 3, text: 'CAD and electrical teams formed up, and the swerve chassis hit the floor.' },
		{ week: 1, dates: 'Sept 7–10', photos: 4, text: 'Preseason starts. Logistics and mechanical teams get going on day one.' },
	],
	weekLabel: 'Week',
};

/** "About Team 10951": the team photo, the sub-teams and how new members join. */
export const teamMore = {
	photo: 'team' as FrcPhotoId,
	subTeamsHeading: 'Seven sub-teams. One robot.',
	subTeamsIntro: 'The students who machine parts also write the business plan and run outreach. Each sub-team has its own student lead, guided by mentors: the program director and two advisors.',
	meets: 'The team meets on Monday and Thursday.',
	subTeams: [
		{ name: 'CAD & Design', role: 'Turns ideas into Onshape models the shop can build from.' },
		{ name: 'Mechanical & Fabrication', role: 'Builds, assembles and repairs the robot.' },
		{ name: 'Electrical', role: 'Wires the robot and keeps it running through every match.' },
		{ name: 'Programming', role: 'Writes the robot code in WPILib, from swerve control to vision.' },
		{ name: 'Strategy', role: 'Studies the game, scouts the field and trains the drive team.' },
		{ name: 'Marketing & Media', role: 'Tells the team’s story at school and online.' },
		{ name: 'Business & Outreach', role: 'Finds partners, plans travel and runs outreach.' },
	],
	joinHeading: 'Find your way in',
	join: [
		{ title: 'Full-time', text: 'For members on the project side: mechanical, electrical, programming, design, logistics and CAD. You come to both meetings each week; consistency matters most.' },
		{ title: 'Part-time', text: 'For members on the logistics side: communications, business, outreach, community, statistics, strategy and scouting. Pick one meeting day and keep it.' },
	],
	joinNote: 'Roles can change as your skills grow.',
};

/** The workshop: how a student is certified on a machine, the checklist, and the photos. */
export const workshop = {
	heading: 'Nobody touches a machine untrained.',
	intro: 'Every tool has a certification path, and nobody works alone in the workshop.',
	photo: 'ws' as FrcPhotoId,
	stepsHeading: 'The certification path',
	steps: [
		{ title: 'Safety protocol', text: 'Learn the shop rules and the Safety and Basic Use (SBU) guidelines for the machine you want to run.' },
		{ title: 'Digital test', text: 'Pass the written test for that machine before you go near it.' },
		{ title: 'Supervisor demo', text: 'A mentor runs the machine and walks you through every step and every hazard.' },
		{ title: 'Student demo', text: 'You run the same operation while the mentor watches and corrects.' },
		{ title: 'Practical check', text: 'You complete a real job on the machine and a mentor signs you off.' },
		{ title: 'Certified', text: 'You may use the machine on your own. A mentor is still in the room.' },
	],
	rulesHeading: 'Before you start',
	rules: [
		{ title: 'Eye protection', text: 'Safety glasses whenever tools, robots or active work are running. If the robot is live, everyone nearby wears them.' },
		{ title: 'Footwear', text: 'Closed-toe shoes, always.' },
		{ title: 'Distractions', text: 'No earbuds. Phones and laptops only when the work needs them.' },
		{ title: 'Hazards', text: 'No backpacks in the active work area. Keep the floor clear.' },
	],
	checklistHeading: 'Workroom checklist',
	checklist: [
		'Ask before using tools. No machine use without training.',
		'No rushing.',
		'Tie back hair and keep hands clear.',
		'Clean as you go.',
		'Return tools to their proper home.',
		'Report unsafe behaviour immediately.',
	],
	photosLabel: 'In the workshop',
	photos: ['st0', 'st1', 'st2', 'st3', 'st4', 'st5', 'st6'] as FrcPhotoId[],
};

/** Outreach: the team's programs beyond the field. */
export const outreach = {
	heading: 'Engineering, put to work.',
	intro: 'Student-led programs that take what we learn in the workshop to younger students, partner schools and the wider community.',
	programs: [
		{ name: 'RoboKids', tag: 'Running now · every other Friday', text: 'FRC members run hands-on robotics sessions for younger SSIS students in our workshop. Kids build, code on tablets and test their robots on a real practice field.', detail: 'Fall 2026 sessions so far: Sept 4, Sept 18 and Oct 2, each led by student volunteers from the team.' },
		{ name: 'Poussières de Vie', tag: 'Beyond SSIS', text: 'Full-day Saturday workshops at SSIS for children from Poussières de Vie, an NGO that educates disadvantaged children in Ho Chi Minh City. The team handles the arrangements.' },
		{ name: 'EmpowerTech', tag: 'Running', text: 'Technology workshops and fundraising for children from marginalised communities, developed with our sister school, LSTS.' },
		{ name: 'FRC Core Labs', tag: 'New', text: 'Students find practical problems in the school or community, then design, prototype and build solutions.' },
	],
	photosLabel: 'RoboKids',
	photos: ['rk0', 'rk5', 'rk3', 'rk4', 'rk1', 'rk2'] as FrcPhotoId[],
	privacy: 'We keep younger participants’ faces out of our public photos.',
};

/** Partnering with the team. */
export const partner = {
	heading: 'Put tools in students’ hands.',
	tag: 'Gifts in kind only',
	text: 'We welcome tools, equipment, materials, services and mentors’ time. We do not accept cash donations. Recognition or publicity happens only when SSIS approves it and both sides agree.',
	kinds: [
		{ name: 'Tools & equipment', items: ['Robot design, fabrication and maintenance', 'Safe, reliable equipment in the workshop', 'Training new members on real tools'] },
		{ name: 'Mentorship & workshops', items: ['Engineers leading technical workshops', 'Tool safety sessions and build demos', 'Direct feedback on design and fabrication'] },
		{ name: 'Robot parts & materials', items: ['Prototyping stock for mechanism testing', 'Spares for the swerve-drive platform', 'Electrical components for the practice boards'] },
		{ name: 'Travel & logistics', items: ['Robot freight and shipping services', 'Travel or accommodation provided in kind', 'Logistics help at events'] },
		{ name: 'Outreach programs', items: ['RoboKids sessions for young children', 'EmpowerTech workshops with LSTS', 'FRC Core Labs prototypes for the community'] },
	],
	backHeading: 'What partners get back',
	back: ['Milestone updates with photos', 'Verified outreach numbers and sessions held', 'A season-end summary of what your support did', 'Student presentations and robot demos'],
	button: 'Become a partner',
	emailSubject: 'FRC 10951: becoming a partner',
};

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
