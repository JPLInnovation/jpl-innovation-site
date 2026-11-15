import assert from "node:assert/strict";
import { test } from "node:test";
import { lab, prompt, run } from "./ios.ts";

const LAB = { hosts: ["192.168.10.10", "192.168.20.10"] };
const session = (...lines: string[]) => {
	const d = lab(LAB);
	const out = lines.map((line) => run(d, line));
	return { d, out, last: out[out.length - 1].join("\n") };
};

test("starts in privileged mode on the lab's Layer 3 switch", () => {
	assert.equal(prompt(lab(LAB)), "L3SW#");
});

test("abbreviations: conf t, int vlan 10, end", () => {
	const { d } = session("conf t", "int vlan 10");
	assert.equal(prompt(d), "L3SW(config-if)#");
	run(d, "end");
	assert.equal(prompt(d), "L3SW#");
});

test("show vlan brief lists the lab's VLANs and their ports", () => {
	const { last } = session("sh vlan br");
	assert.match(last, /10\s+LAB\s+active\s+Fa0\/1, Fa0\/2/);
	assert.match(last, /20\s+STAFF\s+active\s+Fa0\/3, Fa0\/4/);
});

test("a new VLAN and its name show up", () => {
	const { last } = session("configure terminal", "vlan 30", "name GUEST", "end", "show vlan brief");
	assert.match(last, /30\s+GUEST\s+active/);
});

test("show ip interface brief: the gateways are up", () => {
	const { last } = session("show ip interface brief");
	assert.match(last, /Vlan10\s+192\.168\.10\.1\s+YES manual up\s+up/);
	assert.match(last, /FastEthernet0\/1\s+unassigned/);
});

test("shutdown takes an interface down and says so", () => {
	const { out, d } = session("conf t", "interface vlan 20", "shutdown", "do show ip interface brief");
	assert.match(out[2].join("\n"), /changed state to administratively down/);
	assert.match(out[3].join("\n"), /Vlan20\s+192\.168\.20\.1\s+YES manual administratively down down/);
	assert.equal(prompt(d), "L3SW(config-if)#");
});

test("an ACL: deny telnet, permit the rest, applied, shown with sequence numbers and port names", () => {
	const { last } = session(
		"conf t",
		"access-list 110 deny tcp any any eq 23",
		"access-list 110 permit ip any any",
		"int vlan 10",
		"ip access-group 110 in",
		"end",
		"show access-lists",
	);
	assert.match(last, /Extended IP access list 110\n\s+10 deny tcp any any eq telnet\n\s+20 permit ip any any/);
});

test("running-config reflects what was typed", () => {
	const { last } = session("conf t", "hostname R2", "end", "show run");
	assert.match(last, /^hostname R2$/m);
	assert.match(last, /^interface Vlan10\n ip address 192\.168\.10\.1 255\.255\.255\.0$/m);
	assert.match(last, /Current configuration : \d+ bytes/);
});

test("the prompt follows the hostname", () => {
	const { d } = session("conf t", "hostname EDGE");
	assert.equal(prompt(d), "EDGE(config)#");
});

test("SSH needs a domain name and keys first", () => {
	const { out } = session("conf t", "crypto key generate rsa modulus 2048", "ip ssh version 2", "ip domain-name jpl.lab", "crypto key generate rsa modulus 2048", "ip ssh version 2");
	assert.match(out[1].join("\n"), /domain-name first/);
	assert.match(out[2].join("\n"), /create RSA keys/);
	assert.match(out[4].join("\n"), /Generating 2048 bit RSA keys/);
	assert.deepEqual(out[5], []);
});

test("ping: the switch's own gateway, a lab PC, and an address nobody has", () => {
	const { out } = session("ping 192.168.10.1", "ping 192.168.20.10", "ping 192.168.20.10", "ping 10.9.9.9");
	assert.match(out[0].join("\n"), /!!!!!\nSuccess rate is 100 percent \(5\/5\)/);
	assert.match(out[1].join("\n"), /\.!!!!\nSuccess rate is 80 percent \(4\/5\)/);
	assert.match(out[2].join("\n"), /!!!!!/);
	assert.match(out[3].join("\n"), /\.\.\.\.\.\nSuccess rate is 0 percent \(0\/5\)/);
});

test("a shut gateway stops answering pings", () => {
	const { last } = session("conf t", "int vlan 10", "shut", "end", "ping 192.168.10.1");
	assert.match(last, /Success rate is 0 percent/);
});

test("errors read like IOS: invalid (with the marker), incomplete, ambiguous, unknown", () => {
	const d = lab(LAB);
	const bad = run(d, "show bananas");
	assert.equal(bad[bad.length - 1], "% Invalid input detected at '^' marker.");
	assert.equal(bad[0].indexOf("^"), "L3SW#".length + "show ".length);
	assert.deepEqual(run(d, "show"), ["% Incomplete command."]);
	assert.match(run(d, "c")[0], /Ambiguous command/);
	assert.match(run(d, "hello")[0], /Unknown command/);
});

test("bad addresses and masks are refused", () => {
	const { out } = session("conf t", "int vlan 10", "ip address 300.1.1.1 255.255.255.0", "ip address 10.0.0.1 255.0.255.0");
	assert.match(out[2].join("\n"), /Invalid input/);
	assert.match(out[3].join("\n"), /Bad mask|Invalid input/);
});

test("? lists the commands of the mode, and show ?", () => {
	const d = lab(LAB);
	assert.ok(run(d, "?").some((l) => /^\s+configure\s/.test(l)));
	assert.ok(run(d, "show ?").some((l) => /^\s+running-config\s/.test(l)));
	run(d, "conf t");
	assert.ok(run(d, "?").some((l) => /^\s+interface\s/.test(l)));
});

test("disable and enable move between user and privileged mode", () => {
	const { d } = session("disable");
	assert.equal(prompt(d), "L3SW>");
	assert.match(run(d, "conf t")[1] ?? run(d, "conf t")[0], /Invalid input|Unknown/);
	run(d, "en");
	assert.equal(prompt(d), "L3SW#");
});

test("switchport access vlan creates a missing VLAN, as IOS does", () => {
	const { out, last } = session("conf t", "int fa0/2", "switchport access vlan 40", "end", "show vlan brief");
	assert.match(out[2].join("\n"), /Creating vlan 40/);
	assert.match(last, /40\s+VLAN0040\s+active\s+Fa0\/2/);
});

test("copy run start and write memory save", () => {
	assert.match(session("copy running-config startup-config").last, /\[OK\]/);
	assert.match(session("wr").last, /\[OK\]/);
});

test("a global command in a sub-mode leaves it and runs, as IOS does", () => {
	const { d } = session("conf t", "int vlan 10", "vlan 30", "name GUEST");
	assert.equal(prompt(d), "L3SW(config-vlan)#");
	run(d, "hostname EDGE");
	assert.equal(prompt(d), "EDGE(config)#");
});
