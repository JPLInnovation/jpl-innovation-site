/**
 * HOME PAGE TEXT (jpl-innovation.github.io/), from top to bottom.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 * The project cards in "Selected work" come from src/text/projects/*.md,
 * and the people in "The team" come from src/text/members/*.md.
 */
import { site } from "./site";

/** Hidden heading for screen readers and search engines. */
export const pageHeading = "JPL Innovation: a student-founded engineering startup in Ho Chi Minh City";

/** The opening screen: the big "JPL" letters, then the photo with the intro over it. */
export const hero = {
	/** Small line above the big letters. */
	kicker: "Student-founded engineering startup · Ho Chi Minh City",
	/** Line under the big letters. */
	support: "We design, build and secure real technology: robots, drones, networks and the web.",
	/** Button that flies the camera through the letters. */
	enterButton: "See what we build",
	scrollHint: "Scroll to fly in",
	/** Shown over the photo once the camera is through the letters. */
	heading: "Ideas in, working technology out.",
	text: "JPL Innovation is a small team of student engineers. We take projects from the first sketch to a tested, working build (machines, networks and software) and document what we learn along the way.",
	servicesButton: "Our services",
	workButton: "See our work",
	photoCaption: "Pictured: FRC Team 10951’s 2026 robot, one of the projects we work on.",
};

/**
 * "What we do": JPL Innovation's services.
 *
 * TODO: confirm services — these are PLACEHOLDERS. Nothing in the repo documented what JPL Innovation
 * offers, so each one is inferred from a project on this site (linked in `proof`). Edit the wording,
 * remove any you don't offer, or add new ones. The same titles are listed over the photo in the hero.
 */
export const servicesSection = {
	heading: "What we do",
	intro: "Hardware, networks and software, taken from the first sketch to a tested, working build.",
	/** Put before each service's link, e.g. "See it: FRC robot". */
	linkPrefix: "See it:",
};

export interface Service {
	/** Icon: "cog" | "drone" | "shield" | "code". */
	icon: "cog" | "drone" | "shield" | "code";
	title: string;
	desc: string;
	/** The project on this site that shows this work. */
	proof: { label: string; href: string };
}

export const services: Service[] = [
	{
		icon: "cog",
		title: "Robotics & mechanical design",
		desc: "CAD, prototyping and fabrication of mechanisms that hold up in real use, from concept to a tested build.",
		proof: { label: "FRC robot", href: "/work/frc/" },
	},
	{
		icon: "drone",
		title: "Embedded systems & drones",
		desc: "Flight controllers, sensors and single-board computers wired into working machines, including live video over 4G.",
		proof: { label: "F450 4G drone", href: "/work/drone/" },
	},
	{
		icon: "shield",
		title: "Networking & cybersecurity",
		desc: "Designing, configuring and hardening networks: Cisco routing and switching, Windows Server infrastructure, access control.",
		proof: { label: "Cybersecurity lab", href: "/work/cybersecurity/" },
	},
	{
		icon: "code",
		title: "Web development",
		desc: "Fast, accessible websites built and deployed end to end, like this one.",
		proof: { label: "Source on GitHub", href: site.github },
	},
];

/** "Selected work": the heading above the project cards. */
export const workSection = {
	heading: "Selected work",
	intro: "Our own builds and the team we compete with: a drone that streams over 4G, a secured network lab, and an FRC robot.",
};

/** "Our mission", the standards list, and "How we work". */
export const mission = {
	label: "Our mission",
	statement:
		"Technology is a tool for impact. We keep pushing our skills through ambitious builds, careful experiments, and working together every week.",
	standardsHeading: "What we hold ourselves to",
	standards: [
		"Projects that are demoable, measurable, and improving over time.",
		"Clean foundations: documentation, version control, and repeatable setups.",
		"Real-world skills: problem-solving, communication, and teamwork.",
	],
	processHeading: "How we work",
	/** Put before each step's number: "Step 1", "Step 2"... */
	stepLabel: "Step",
	// TODO: confirm process copy — written to match the services placeholders above.
	/** Icon: "plan" | "build" | "check". */
	process: [
		{
			icon: "plan",
			title: "Plan",
			desc: "Understand the goal, sketch the options, and agree on what “done” looks like before building anything.",
		},
		{
			icon: "build",
			title: "Build and test",
			desc: "Prototype, measure and iterate until it works reliably, not just once.",
		},
		{
			icon: "check",
			title: "Hand over",
			desc: "Document everything so the result can be maintained, reused and improved.",
		},
	] as const,
};

/**
 * The timeline. `state`: "past" (solid dot), "now" (highlighted, with a "Now" tag), "future" (dashed).
 * Keep exactly one "now". The line across the top draws from the first year to the "Now" dot.
 */
export const journey = {
	heading: "Where we've been, and where we're going",
	nowTag: "Now",
	milestones: [
		{ year: "2023", title: "Foundation and exploration", desc: "Learned programming fundamentals, explored tools, and built our first projects.", state: "past" },
		{ year: "2024", title: "Project development", desc: "More hands-on robotics and software builds, and a growing portfolio.", state: "past" },
		{ year: "2025", title: "Innovation and growth", desc: "Stronger full-stack foundations, better quality, and this site.", state: "past" },
		{ year: "2026", title: "Professional development", desc: "Bigger builds, open source, internships, and leading on FRC Team 10951’s rookie season.", state: "now" },
		{ year: "2027–28", title: "Industry leadership", desc: "Lead projects with strong engineering habits and ship tools real people use.", state: "future" },
		{ year: "2029+", title: "Creating the future", desc: "Larger-impact projects, mentoring others, and learning as technology moves.", state: "future" },
	] as Array<{ year: string; title: string; desc: string; state: "past" | "now" | "future" }>,
};

/** "The team" section. The member cards come from src/text/members/*.md. */
export const teamSection = {
	heading: "The team",
	intro: "The founders and students behind JPL Innovation.",
	allMembersLink: "All members",
};
