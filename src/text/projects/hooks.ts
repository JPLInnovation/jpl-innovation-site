/**
 * THE CASE AT THE TOP OF EVERY PROJECT PAGE (src/components/ProjectCase.astro), one per project id (the file names in
 * src/text/projects/). It reads in this order: the problem, why the obvious alternatives fall short, our answer, what
 * it gets you, and (when there is one) the partner who takes it to people.
 *
 * Edit the words between the quotes. Every claim here must be true: the facts come from the project's own page text.
 * Alternatives are named by kind ("a ready-made camera drone"), never by brand.
 */

export interface ProjectCase {
	problem: { title: string; text: string };
	/** "Why not just…": the options a reader would think of first, and the catch in each. */
	alternatives: Array<{ option: string; catch: string }>;
	answer: { title: string; text: string };
	/** What the answer gets you. */
	pros: Array<{ title: string; text: string }>;
	partner?: { name: string; role: string; text: string; href: string; link: string };
}

/** Headings shared by every case. */
export const caseLabels = {
	problem: "The problem",
	alternatives: "Why not just…",
	answer: "Our answer",
	pros: "What it gets you",
	partner: "Partner",
};

export const hooks: Record<string, ProjectCase> = {
	drone: {
		problem: {
			title: "The picture ends where the radio ends.",
			text: "A camera drone sends its picture back over its own radio. Where that link ends, the picture ends, and only the person holding the receiver sees it.",
		},
		alternatives: [
			{ option: "A ready-made camera drone", catch: "Its video still comes back over its own radio link, and nothing inside it is ours to change or learn from." },
			{ option: "A longer-range radio", catch: "More distance, but still one link from the drone to one receiver." },
		],
		answer: {
			title: "Put the video on the 4G mobile network.",
			text: "A Raspberry Pi 4 streams the Camera Module 3 over a 4G modem, so the video can be watched from anywhere with signal, while the flight controller keeps flying on its own radio.",
		},
		pros: [
			{ title: "Range set by the network", text: "Where there is 4G signal, there is video: the radio no longer decides how far you can watch." },
			{ title: "720p at 60 fps", text: "Or 1080p at 30 fps, from the Camera Module 3 straight into the Pi." },
			{ title: "Video can’t starve the flight", text: "The Pi, camera and modem have their own 5 V supply, so they can never brown out the flight controller." },
			{ title: "A live dashboard", text: "The Pi reads flight data from the flight controller and serves it live, next to the video." },
			{ title: "Every part known and priced", text: "The whole build is listed below, part by part, with what each one is for." },
		],
	},
	"mini-drone": {
		problem: {
			title: "A toy drone teaches you to fly it, not how it flies.",
			text: "Out of the box, the stabilisation, the radio and the motor control are sealed inside. To understand them, you have to build them.",
		},
		alternatives: [
			{ option: "A ready-to-fly micro drone", catch: "It flies today, but there is nothing to learn from the inside." },
			{ option: "An off-the-shelf flight controller and radio", catch: "It would fly sooner, and hide exactly the stabilisation loop and radio protocol we want to understand." },
		],
		answer: {
			title: "Build every layer ourselves.",
			text: "An Arduino Pro Mini runs the stabilisation loop from an MPU-6050, MOSFETs drive the four coreless motors, and our own 2.4GHz NRF24L01 link carries the commands from a hand-built transmitter.",
		},
		pros: [
			{ title: "Every layer is ours", text: "Motor control, IMU stabilisation and the RC protocol, all readable and all changeable." },
			{ title: "Palm-sized", text: "A 69 mm frame, motor to motor, on a 1S LiPo." },
			{ title: "A radio from scratch", text: "Our own protocol over 2.4GHz, with a long-range module on the transmitter." },
			{ title: "A transmitter that talks back", text: "Its LCD shows the link and battery status." },
		],
	},
	frc: {
		problem: {
			title: "Real engineering has a deadline, a budget and an opponent.",
			text: "A full-size robot, designed, built and programmed in weeks, then raced against teams from around the world. That is hard to learn anywhere but on a team.",
		},
		alternatives: [
			{ option: "A small-kit robotics club", catch: "Good for learning, but nowhere near a 140 lb robot built against a season’s clock." },
			{ option: "Learning engineering on our own", catch: "No field, no deadline, no alliance partners, no one across the field." },
		],
		answer: {
			title: "FRC Team 10951, the Saigon South Dragons.",
			text: "A rookie FIRST Robotics Competition team at SSIS: student-led sub-teams with mentors beside them, building a competition robot each season and taking it to regionals abroad.",
		},
		pros: [
			{ title: "Two regionals in the rookie season", text: "Vancouver, then Istanbul, three places higher the second time." },
			{ title: "Picked first, twice", text: "Alliance captains chose 10951 with their first pick at both regionals." },
			{ title: "Reliability first", text: "The autonomous routine was tuned until it worked 95% of the time over 50+ trials." },
			{ title: "A swerve drive for 2027", text: "Built in 2026, it is the team’s drivebase for the next season." },
			{ title: "Beyond the robot", text: "RoboKids, EmpowerTech and FRC Core Labs take the workshop to younger students and the community." },
		],
	},
	cybersecurity: {
		problem: {
			title: "Every robot, drone and web app we build sits on a network.",
			text: "If we don’t know how that network is put together, and how it can be attacked, we can’t keep our projects safe.",
		},
		alternatives: [
			{ option: "Trusting the default settings", catch: "Defaults leave unused ports open and device access weak until someone hardens them." },
			{ option: "Learning from videos alone", catch: "You can watch a VLAN being set up; you only understand it once you have typed the config yourself." },
		],
		answer: {
			title: "Learn it hands-on, on real equipment.",
			text: "CCNA routing and switching and Windows Server infrastructure: first through CCNA-related study, then hands-on training at VnPro academy.",
		},
		pros: [
			{ title: "Real configs", text: "Routers and Layer 2 and Layer 3 switches, configured on a Cisco console." },
			{ title: "Traffic under control", text: "VLANs, routing between them, and ACLs that filter what gets through." },
			{ title: "Windows infrastructure", text: "Active Directory, DNS and DHCP, and Group Policy to enforce security settings." },
			{ title: "Secure habits", text: "Strong passwords, SSH, and unused ports shut down." },
		],
	},
	lifetime: {
		problem: {
			title: "You can’t look after computers you can’t see.",
			text: "Schools and offices run rooms full of Windows computers. Which ones are on, which are wearing out, and which were left on all night is hard to know without walking the rooms.",
		},
		alternatives: [
			{ option: "A monitor that pings the network", catch: "It guesses from the network whether a computer answered. When the network or the monitor is down, the record is wrong." },
			{ option: "A cloud management service", catch: "The data leaves the building. Lifetime keeps everything on the customer’s own server." },
			{ option: "A paid monitoring suite", catch: "Licence fees for the software itself. Lifetime has none: it is open source." },
		],
		answer: {
			title: "Let every computer count for itself.",
			text: "The Lifetime desktop app counts each computer’s real awake time from inside the machine, and Lifetime Server brings every computer onto one dashboard.",
		},
		pros: [
			{ title: "Counts from the inside", text: "If the network or the server goes down, each computer keeps counting and sends the data later." },
			{ title: "Never guesses", text: "Time when the server was off is Unknown, not counted as online or offline." },
			{ title: "Private by design", text: "No screens, keystrokes, browsing or file contents, and each owner chooses what to share." },
			{ title: "Your server, your network", text: "All the data stays on site. There is no cloud service." },
			{ title: "Free and open source", text: "GPL-3.0, with the code public on GitHub." },
			{ title: "Light", text: "In testing, about 1.8% CPU and 61 MB of memory with 50 simulated computers." },
		],
		partner: {
			name: "COBACOM",
			role: "Deployment and support in Vietnam",
			text: "COBACOM, an IT equipment and services company, deploys Lifetime for schools and offices, with installation, setup, training and support.",
			href: "https://www.cobacom.com/vi",
			link: "Visit COBACOM",
		},
	},
};
