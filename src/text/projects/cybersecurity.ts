/**
 * CYBERSECURITY PAGE TEXT (/work/cybersecurity/): the labels and headings around the write-up.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - The page title, intro sentence and the long write-up: src/text/projects/cybersecurity.md
 *   - The commands typed out in the Cisco console, and the lab the console runs: src/text/projects/cybersecurity-terminal.ts
 *   - Labels inside the 3D network: src/lib/three/models/network.ts
 */

export const cyberPage = {
	/** The title block under the intro: the sheet's own details (facts from cybersecurity.md and the console's lab). */
	titleBlock: {
		label: "Title block",
		rows: [
			{ label: "Sheet", value: "Network diagram" },
			{ label: "Training", value: "VnPro academy" },
			{ label: "Lab", value: "VLAN 10 and VLAN 20, routed on a Layer 3 switch" },
			{ label: "Track", value: "CCNA routing and switching · Windows Server" },
		],
		/** Shown with the status from cybersecurity.md (`badge`). */
		statusLabel: "Status",
	},
	model3d: {
		/** Hidden heading for screen readers. */
		heading: "The lab network in 3D",
		/** Read aloud by screen readers instead of the 3D model. */
		description:
			"3D lab network: internet, an ACL shield, a router, a Layer 3 switch, two Layer 2 switches on VLAN 10 and VLAN 20, four PCs and a Windows Server, with packets flowing between them. One packet is dropped at the ACL; another changes colour as it is routed between VLANs.",
		/** The coloured dots under the 3D network. */
		legend: {
			vlan10: "VLAN 10",
			vlan20: "VLAN 20",
			allowed: "Internet traffic the ACL allows",
			dropped: "Traffic the ACL drops",
		},
		caption:
			"Watch a packet change colour as the L3 switch routes it from VLAN 10 to VLAN 20, and the shield flash when the ACL drops one.",
	},
	/** The write-up under the case (cybersecurity.md), as the sheet's notes: its heading for screen readers. */
	notesHeading: "Notes",
	ccna: {
		heading: "CCNA in motion",
		intro: "The configs behind the lab above, typed out on a Cisco console, and the subnet maths every network starts from.",
		/** Title bar of the console window. */
		consoleTitle: "Console · Cisco IOS",
		/** Under the console: the invitation to type. */
		yourTurn: "Your turn: type a real IOS command and press Enter. Try show vlan brief, ping 192.168.20.10, conf t, or ? for help.",
		/** Greyed out in the empty command line, as a first thing to try. */
		placeholder: "show vlan brief",
		/** The input's name, read aloud. */
		inputLabel: "Type a Cisco IOS command",
		/** Printed on the console when the visitor starts typing. */
		handover: "! Your turn. You're on the lab's Layer 3 switch, configured as above.",
		/** The row of configs the console types out. */
		scenesLabel: "Configurations",
	},
	subnet: {
		heading: "Subnetting: one /24 into four /26s",
		text: "Borrowing 2 host bits gives 2² = 4 subnets, each with 2⁶ − 2 = 62 usable host addresses.",
		columns: { subnet: "Subnet", hosts: "Usable hosts", broadcast: "Broadcast" },
		/** The two figures that prove it, counted up beside the bar. */
		figures: { subnets: "subnets", hosts: "usable hosts in each" },
	},
};
