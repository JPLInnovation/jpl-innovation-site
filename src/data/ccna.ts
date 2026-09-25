/**
 * Cisco IOS walkthroughs typed out by the terminal on the Cybersecurity page (src/components/IosTerminal.astro).
 * Each line is a prompt + command, or `out` for device output. Standard IOS syntax; addresses match the lab
 * in the 3D model (VLAN 10 = 192.168.10.0/24, VLAN 20 = 192.168.20.0/24).
 */
export interface TerminalLine {
	prompt?: string;
	cmd?: string;
	out?: string;
}

export interface TerminalScene {
	id: string;
	label: string;
	/** One sentence under the terminal explaining what the config does. */
	note: string;
	lines: TerminalLine[];
}

export const terminalScenes: TerminalScene[] = [
	{
		id: "vlans",
		label: "VLANs",
		note: "Split one switch into two networks, so the lab and staff machines can't see each other's traffic.",
		lines: [
			{ prompt: "SW1#", cmd: "configure terminal" },
			{ prompt: "SW1(config)#", cmd: "vlan 10" },
			{ prompt: "SW1(config-vlan)#", cmd: "name LAB" },
			{ prompt: "SW1(config-vlan)#", cmd: "vlan 20" },
			{ prompt: "SW1(config-vlan)#", cmd: "name STAFF" },
			{ prompt: "SW1(config-vlan)#", cmd: "interface fa0/1" },
			{ prompt: "SW1(config-if)#", cmd: "switchport mode access" },
			{ prompt: "SW1(config-if)#", cmd: "switchport access vlan 10" },
			{ prompt: "SW1(config-if)#", cmd: "end" },
			{ prompt: "SW1#", cmd: "show vlan brief" },
			{ out: "VLAN Name       Status    Ports" },
			{ out: "---- ---------- --------- ------" },
			{ out: "10   LAB        active    Fa0/1" },
			{ out: "20   STAFF      active" },
		],
	},
	{
		id: "routing",
		label: "Inter-VLAN routing",
		note: "Give each VLAN a gateway on the Layer 3 switch, so traffic can be routed between them on purpose.",
		lines: [
			{ prompt: "L3SW(config)#", cmd: "ip routing" },
			{ prompt: "L3SW(config)#", cmd: "interface vlan 10" },
			{ prompt: "L3SW(config-if)#", cmd: "ip address 192.168.10.1 255.255.255.0" },
			{ prompt: "L3SW(config-if)#", cmd: "no shutdown" },
			{ prompt: "L3SW(config-if)#", cmd: "interface vlan 20" },
			{ prompt: "L3SW(config-if)#", cmd: "ip address 192.168.20.1 255.255.255.0" },
			{ prompt: "L3SW(config-if)#", cmd: "no shutdown" },
			{ prompt: "L3SW(config-if)#", cmd: "end" },
			{ prompt: "L3SW#", cmd: "show ip interface brief | include Vlan" },
			{ out: "Vlan10   192.168.10.1   YES manual up   up" },
			{ out: "Vlan20   192.168.20.1   YES manual up   up" },
		],
	},
	{
		id: "acl",
		label: "ACL",
		note: "Drop Telnet from outside and let everything else through: the red packets in the 3D model.",
		lines: [
			{ prompt: "R1(config)#", cmd: "access-list 110 deny tcp any any eq 23" },
			{ prompt: "R1(config)#", cmd: "access-list 110 permit ip any any" },
			{ prompt: "R1(config)#", cmd: "interface g0/0" },
			{ prompt: "R1(config-if)#", cmd: "ip access-group 110 in" },
			{ prompt: "R1(config-if)#", cmd: "end" },
			{ prompt: "R1#", cmd: "show access-lists 110" },
			{ out: "Extended IP access list 110" },
			{ out: "    10 deny tcp any any eq telnet" },
			{ out: "    20 permit ip any any" },
		],
	},
	{
		id: "ssh",
		label: "SSH hardening",
		note: "Replace plain-text Telnet logins with encrypted SSH and a local admin account.",
		lines: [
			{ prompt: "R1(config)#", cmd: "ip domain-name jpl.lab" },
			{ prompt: "R1(config)#", cmd: "crypto key generate rsa modulus 2048" },
			{ out: "% Generating 2048 bit RSA keys, keys will be non-exportable..." },
			{ out: "[OK]" },
			{ prompt: "R1(config)#", cmd: "username admin secret ********" },
			{ prompt: "R1(config)#", cmd: "ip ssh version 2" },
			{ prompt: "R1(config)#", cmd: "line vty 0 4" },
			{ prompt: "R1(config-line)#", cmd: "transport input ssh" },
			{ prompt: "R1(config-line)#", cmd: "login local" },
		],
	},
];
