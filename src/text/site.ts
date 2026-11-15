/**
 * TEXT SHOWN ON EVERY PAGE: the name, contact email, menu, footer, the blue "Let's work together" box
 * at the bottom of each page, the email pop-up, and the "Page not found" page.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 * A ’ (curly apostrophe) and a ' (straight one) both work inside "double quotes".
 */

export const site = {
	name: "JPL Innovation",
	/** Under the logo on the opening page (the logo intro, src/components/IntroSplash.astro). */
	slogan: "Sketch it. Build it. Secure it.",
	/** The contact address. Change it here and it updates everywhere (menu, footer, contact box, pop-up). */
	email: "jpl.innovation05@gmail.com",
	/** Shown by Google and link previews when a page doesn't have its own description. */
	description:
		"JPL Innovation is a student-founded engineering startup in Ho Chi Minh City: robotics and mechanical design, embedded systems and drones, networking and cybersecurity, and web development.",
} as const;

/**
 * Top menu, in the middle of the header. Services and Contact moved: Services is a scene of the home studio (and in
 * the footer), and Contact is the "Let's talk" button at the right of the header (`talk` below).
 */
export const menu = [
	{ label: "Work", href: "/work/" },
	{ label: "Members", href: "/members/" },
	{ label: "About", href: "/about/" },
];

/**
 * The web address drawn on the studio's screens (the research monitor, the laptop) and on the team badges.
 * It is made up: the site is not on a domain of its own yet. When it is, change this one line.
 */
export const displayDomain = "jplinnovation.vn";

/** The glass button at the far right of the header: opens the email pop-up from any page. */
export const talk = {
	label: "Let’s talk",
	subject: "Hello JPL Innovation",
};

/** The Settings panel (the gear in the header). */
export const settings = {
	button: "Settings",
	heading: "Settings",
	theme: { label: "Theme", light: "Light", dark: "Dark" },
	experience: {
		label: "Experience",
		classic: "Classic",
		threeD: "3D",
		/** Under the choices. */
		note: "3D turns the home page into a walk through our studio. It can lag on older computers.",
	},
	motion: {
		label: "Motion",
		full: "Full",
		reduced: "Reduced",
		read: "Read mode",
		/** Under the choices. */
		note: "Read mode shows every page as one ordinary page: no 3D camera, no animation.",
	},
	sound: { label: "Sound", off: "Off", on: "On", note: "Sound comes later: room tone and the sounds of the bench, all recorded by us." },
	/** Glass (frosted, see-through sheets) or Solid (filled sheets: lighter on older computers). */
	style: { label: "Style", glass: "Glass", solid: "Solid", note: "Glass shows the blueprint through the page. Solid is lighter on older computers." },
	quality: { label: "3D quality", auto: "Auto", high: "High", low: "Low", note: "Auto picks the best your device can draw smoothly." },
	/** Plays the opening page, the logo and the studio's first words again, and asks Classic or 3D again. */
	replay: "Replay the opening",
	close: "Close settings",
};

/**
 * The question a first-time visitor is asked before any 3D starts (src/components/ExperienceChoice.astro): the 3D studio
 * or the classic page (the same words and pictures as one ordinary page). The answer is saved in this browser and can be
 * changed in the Settings panel. Be straight about the 3D: it can lag on an older computer.
 */
export const experience = {
	title: "Choose your experience",
	description: "Pick the version made for your computer. It is remembered, and you can switch any time in Settings (the gear at the top).",
	threeD: {
		title: "Explore in 3D",
		text: "Walk through our studio as you scroll: the desk, the work benches, the wall of projects.",
		warning: "Can lag on older or slower computers",
		button: "Enter the 3D studio",
	},
	classic: {
		title: "Classic",
		text: "One simple page with the same words and pictures. Easy to read and quick on any computer.",
		note: "Best for older computers and small screens",
		button: "Use the classic site",
	},
};

/**
 * The footer: the back of the sheet, uncovered as the page slides up off it (src/components/SiteFooter.astro). It
 * carries the contact (`contact` below), the game (`landing`), the name at full width and these.
 */
export const footer = {
	blurb:
		"A student-founded engineering startup in Ho Chi Minh City. We design, build and secure real technology: robots, drones, networks and the web.",
	pagesHeading: "Pages",
	pages: [
		{ label: "Services", href: "/#services" },
		{ label: "Work", href: "/work/" },
		{ label: "F450 4G Drone", href: "/work/drone/" },
		{ label: "Lifetime", href: "/work/lifetime/" },
		{ label: "Cybersecurity", href: "/work/cybersecurity/" },
		{ label: "FIRST Robotics", href: "/work/frc/" },
		{ label: "Members", href: "/members/" },
		{ label: "About", href: "/about/" },
	],
	contactHeading: "Contact",
	/** After "© 2026" (the year updates itself). */
	copyright: "JPL Innovation",
};

/** The contact, at the top of the footer on every page. The email address goes between `before` and `after`. */
export const contact = {
	heading: "Let’s work together.",
	before: "Have a project in mind, or want to learn more about what we do at JPL Innovation? Reach out at",
	after: ", and we’d love to hear from you.",
	button: "Email us",
	/** Subject line filled in when someone opens their mail app from this box. */
	subject: "Project enquiry for JPL Innovation",
};

/**
 * "Land the drone", the game in the footer (src/components/footer/LandingGame.astro). {speed} and {fuel} are filled in
 * by the game; keep them.
 */
export const landing = {
	heading: "Land the drone",
	/** How to play, under the drawing (a landing's result takes its place until the next flight). Shown only when the
	 *  game can run; without script, only the link below shows. */
	howTo: "Hold Space, or press and hold, to throttle. Let go to drop. Set it down on the H gently.",
	/** The play area's name for screen readers. */
	stageLabel: "The F450 over its pad. Hold Space, or press and hold, to throttle.",
	altitude: "Altitude",
	speed: "Speed",
	fuel: "Fuel",
	soft: "Soft landing at {speed} m/s, {fuel} s of fuel left.",
	hard: "Hard landing at {speed} m/s. Press again to fly again.",
	/** Before the best landing of this visit. */
	best: "Best this visit",
	bestNone: "no soft landing yet",
	/** The plain link under the game, to the real drone. */
	link: "The real F450",
	href: "/work/drone/",
};

/**
 * Lines in the site's own voice (spec §11). Only lines with `approved: true` appear (at the foot of the footer); the
 * owner approves each one. Keep them true.
 */
export const personality = [
	{ text: "Powered by bánh mì", approved: false },
	{ text: "We break drones so you don’t have to", approved: false },
	{ text: "Bench tested, not yet flown", approved: false },
];

/** The pop-up that opens from any "Email us" button. */
export const emailPopup = {
	title: "Email JPL Innovation",
	description: "Tell us about your project, or ask what we can help with. We read every message.",
	copy: "Copy",
	copied: "Copied",
	close: "Close",
	copyFailed: "Copying isn't allowed here. Select the address above and copy it.",
	openGmail: "Open in Gmail",
	openMailApp: "Open your mail app",
	defaultButton: "Email us",
	defaultSubject: "Hello JPL Innovation",
};

/** The "Page not found" (404) page. */
export const notFound = {
	title: "Page not found",
	/** For search results and link previews. */
	description: "This page doesn't exist.",
	lede: "There's no page at this address. It may have moved when we rebuilt the site.",
	homeButton: "Back to the studio",
	workButton: "See our work",
	/** The drone's camera view that fills the page (the style of the logo intro). */
	signal: {
		headline: "Signal lost",
		kicker: "Error 404 · No link",
		cam: "CAM 01",
		status: "NO LINK",
	},
};
