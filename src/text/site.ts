/**
 * TEXT SHOWN ON EVERY PAGE: the name, contact email, menu, footer, the blue "Let's work together" box
 * at the bottom of each page, the email pop-up, and the "Page not found" page.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 * A ’ (curly apostrophe) and a ' (straight one) both work inside "double quotes".
 */

export const site = {
	name: "JPL Innovation",
	/** The contact address. Change it here and it updates everywhere (menu, footer, contact box, pop-up). */
	email: "jpl.innovation05@gmail.com",
	github: "https://github.com/jpl-innovation",
	/** Shown by Google and link previews when a page doesn't have its own description. */
	description:
		"JPL Innovation is a student-founded engineering startup in Ho Chi Minh City: robotics and mechanical design, embedded systems and drones, networking and cybersecurity, and web development.",
} as const;

/** Top menu. "Contact" jumps to the contact box at the bottom of the current page. */
export const menu = [
	{ label: "Services", href: "/#services" },
	{ label: "Work", href: "/work/" },
	{ label: "Members", href: "/members/" },
	{ label: "Contact", href: "#contact" },
];

export const footer = {
	blurb:
		"A student-founded engineering startup in Ho Chi Minh City. We design, build and secure real technology: robots, drones, networks and the web.",
	pagesHeading: "Pages",
	pages: [
		{ label: "Services", href: "/#services" },
		{ label: "Work", href: "/work/" },
		{ label: "F450 4G Drone", href: "/work/drone/" },
		{ label: "Cybersecurity", href: "/work/cybersecurity/" },
		{ label: "FIRST Robotics", href: "/work/frc/" },
		{ label: "Members", href: "/members/" },
	],
	contactHeading: "Contact",
	githubLabel: "GitHub",
	/** After "© 2026" (the year updates itself). */
	copyright: "JPL Innovation",
};

/** The blue box at the bottom of every page. The email address goes between `before` and `after`. */
export const contact = {
	heading: "Let’s work together.",
	before: "Have a project in mind, or want to learn more about what we do at JPL Innovation? Reach out at",
	after: ", and we’d love to hear from you.",
	button: "Email us",
	/** Subject line filled in when someone opens their mail app from this box. */
	subject: "Project enquiry for JPL Innovation",
};

/** The pop-up that opens from any "Email us" button. */
export const emailPopup = {
	title: "Email JPL Innovation",
	description: "Tell us about your project, or ask what we can help with. We read every message.",
	copy: "Copy",
	copied: "Copied",
	copyFailed: "Copying isn't allowed here. Select the address above and copy it.",
	openGmail: "Open in Gmail",
	openMailApp: "Open your mail app",
	defaultButton: "Email us",
	defaultSubject: "Hello JPL Innovation",
};

/** The "Page not found" (404) page. */
export const notFound = {
	title: "Page not found",
	lede: "There's no page at this address. It may have moved when we rebuilt the site.",
	homeButton: "Go to the home page",
	workButton: "See our work",
};
