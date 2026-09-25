import { site } from "./site";

/**
 * JPL Innovation's services, shown on the home page (#services) and in the hero.
 *
 * TODO: confirm services — these are PLACEHOLDERS. Nothing in the repo documented what JPL Innovation
 * offers, so each one is inferred from a project on this site (linked in `proof`). Edit the wording,
 * remove any you don't offer, or add new ones before publishing.
 */
export interface Service {
	/** lucide-react icon name, mapped in src/pages/index.astro. */
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
