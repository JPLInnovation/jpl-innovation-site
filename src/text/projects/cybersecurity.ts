/**
 * CYBERSECURITY PAGE TEXT (/work/cybersecurity/): the labels and headings around the write-up.
 *
 * Edit the words between the quotes. Keep the quotes and the commas at the end of lines.
 *   - The page title, intro sentence and the long write-up: src/text/projects/cybersecurity.md
 *   - The commands typed out in the Cisco console: src/text/projects/cybersecurity-terminal.ts
 *   - Labels inside the 3D network: src/lib/three/models/network.ts
 */

export const cyberPage = {
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
	ccna: {
		heading: "CCNA in motion",
		intro: "The configs behind the lab above, typed out on a Cisco console, and the subnet maths every network starts from.",
		/** Title bar of the console window. */
		consoleTitle: "Console · Cisco IOS",
	},
	subnet: {
		heading: "Subnetting: one /24 into four /26s",
		text: "Borrowing 2 host bits gives 2² = 4 subnets, each with 2⁶ − 2 = 62 usable host addresses.",
		columns: { subnet: "Subnet", hosts: "Usable hosts", broadcast: "Broadcast" },
	},
};
