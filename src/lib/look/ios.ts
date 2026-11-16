/**
 * The CCNA lab's console (src/components/IosTerminal.astro): a small Cisco IOS command line in the browser, on the
 * lab's Layer 3 switch, so visitors can type real commands and get the replies IOS would give. Pure (no DOM), so
 * `npm test` covers it. The replies are the device's own language, kept here; the page's words live in src/text/.
 *
 * Covered: modes (user, privileged, config, interface, VLAN, line) with IOS abbreviations ("conf t", "int vlan 10",
 * "sh run"), `do`, `?`; VLANs, access ports, SVIs with addresses and shutdown, ip routing, ACLs and access-groups,
 * hostname, domain name, RSA keys, SSH, users, vty lines; show running-config / vlan brief / ip interface brief /
 * access-lists / ip route; ping; copy run start.
 * ponytail: one device, no real packet path (ping knows the switch's own subnets and the lab PCs); a second device
 * would need a topology model.
 */

export type Mode = "user" | "priv" | "config" | "if" | "vlan" | "line";

interface Iface {
	name: string; // "FastEthernet0/1", "GigabitEthernet0/1", "Vlan10"
	ip?: string;
	mask?: string;
	shut: boolean;
	access?: number; // access VLAN (switch ports)
	mode?: "access" | "trunk";
	group?: { acl: string; dir: "in" | "out" };
	description?: string;
}

export interface Device {
	hostname: string;
	mode: Mode;
	at?: string; // the interface, VLAN or line being configured
	vlans: Map<number, string>;
	ifaces: Iface[];
	routing: boolean;
	acls: Map<string, string[]>;
	domain?: string;
	rsa?: number;
	ssh2: boolean;
	users: Map<string, string>;
	enableSecret?: string;
	vty: { transport?: string; login?: "local" | "line"; password?: string };
	hosts: Set<string>;
	known: Set<string>; // addresses already in the ARP table (the first ping to a PC loses one echo)
}

const PORTS = [1, 2, 3, 4].map((n) => `FastEthernet0/${n}`).concat("GigabitEthernet0/1");

/** The lab as the console scenes leave it: VLAN 10 LAB and 20 STAFF, two PCs each, gateways .1 up, routing on. */
export function lab(options: { hosts?: string[] } = {}): Device {
	const ifaces: Iface[] = PORTS.map((name, i) => ({ name, shut: false, ...(i < 4 ? { mode: "access", access: i < 2 ? 10 : 20 } : {}) }));
	ifaces.push({ name: "Vlan1", shut: true });
	ifaces.push({ name: "Vlan10", ip: "192.168.10.1", mask: "255.255.255.0", shut: false });
	ifaces.push({ name: "Vlan20", ip: "192.168.20.1", mask: "255.255.255.0", shut: false });
	return {
		hostname: "L3SW",
		mode: "priv",
		vlans: new Map([
			[1, "default"],
			[10, "LAB"],
			[20, "STAFF"],
		]),
		ifaces,
		routing: true,
		acls: new Map(),
		ssh2: false,
		users: new Map(),
		vty: {},
		hosts: new Set(options.hosts ?? []),
		known: new Set(),
	};
}

const SUFFIX: Record<Mode, string> = { user: ">", priv: "#", config: "(config)#", if: "(config-if)#", vlan: "(config-vlan)#", line: "(config-line)#" };
export const prompt = (d: Device) => d.hostname + SUFFIX[d.mode];

/* ---------- words ---------- */

const AMBIGUOUS = Symbol("ambiguous");
/** IOS abbreviations: an exact word, or the one word the token is the start of. */
function pick(token: string | undefined, words: readonly string[]): string | typeof AMBIGUOUS | undefined {
	if (!token) return undefined;
	const t = token.toLowerCase();
	if (words.includes(t)) return t;
	const hits = words.filter((w) => w.startsWith(t));
	return hits.length === 1 ? hits[0] : hits.length > 1 ? AMBIGUOUS : undefined;
}

class Fail {
	lines: string[];
	constructor(lines: string[]) {
		this.lines = lines;
	}
}
const INCOMPLETE = () => new Fail(["% Incomplete command."]);

/** The parse of one line: its tokens and where each starts, so errors can point at the bad one. */
class Line {
	readonly tokens: string[] = [];
	readonly starts: number[] = [];
	i = 0;
	text: string;
	promptText: string;
	constructor(text: string, promptText: string) {
		this.text = text;
		this.promptText = promptText;
		for (const m of text.matchAll(/\S+/g)) {
			this.tokens.push(m[0]);
			this.starts.push(m.index!);
		}
	}
	invalid(at = this.i) {
		const col = this.promptText.length + (this.starts[at] ?? this.text.trimEnd().length + 1);
		return new Fail([" ".repeat(col) + "^", "% Invalid input detected at '^' marker."]);
	}
	/** The next token as one of `words`, or an IOS error. */
	word(words: readonly string[]): string {
		const token = this.tokens[this.i];
		if (token === undefined) throw INCOMPLETE();
		const hit = pick(token, words);
		if (hit === AMBIGUOUS) throw new Fail([`% Ambiguous command:  "${this.tokens.slice(0, this.i + 1).join(" ")}"`]);
		if (!hit) throw this.invalid();
		this.i++;
		return hit;
	}
	/** The next token as is (a name, a number, an address). */
	arg(check?: (s: string) => boolean): string {
		const token = this.tokens[this.i];
		if (token === undefined) throw INCOMPLETE();
		if (check && !check(token)) throw this.invalid();
		this.i++;
		return token;
	}
	rest() {
		const out = this.tokens.slice(this.i);
		this.i = this.tokens.length;
		return out;
	}
	end() {
		if (this.i < this.tokens.length) throw this.invalid();
	}
	get more() {
		return this.i < this.tokens.length;
	}
}

const num = (lo: number, hi: number) => (s: string) => /^\d+$/.test(s) && +s >= lo && +s <= hi;
const octets = (s: string) => s.split(".").map(Number);
const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && octets(s).every((o) => o <= 255);
const toInt = (s: string) => octets(s).reduce((a, o) => a * 256 + o, 0);
const isMask = (s: string) => {
	if (!isIp(s)) return false;
	const bits = toInt(s).toString(2).padStart(32, "0");
	return /^1+0*$/.test(bits);
};
const prefix = (mask: string) => toInt(mask).toString(2).replace(/0/g, "").length;
const network = (ip: string, mask: string) => {
	const n = (toInt(ip) & toInt(mask)) >>> 0;
	return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
};
const sameNet = (a: string, b: string, mask: string) => network(a, mask) === network(b, mask);

/* ---------- interfaces ---------- */

const short = (name: string) => name.replace("FastEthernet", "Fa").replace("GigabitEthernet", "Gi");

/** "fa0/1", "f 0/1", "gigabitethernet0/1", "vlan 10", "vl10" to the interface's full name (made for a new SVI). */
function ifaceName(parts: string[]): string | undefined {
	const s = parts.join("").toLowerCase();
	const m = /^([a-z]+)([\d/]+)$/.exec(s);
	if (!m) return undefined;
	const [, type, id] = m;
	const full = ["fastethernet", "gigabitethernet", "vlan"].filter((t) => t.startsWith(type));
	if (full.length !== 1) return undefined;
	if (full[0] === "vlan") return num(1, 4094)(id) ? `Vlan${+id}` : undefined;
	const name = (full[0] === "fastethernet" ? "FastEthernet" : "GigabitEthernet") + id;
	return PORTS.includes(name) ? name : undefined;
}

const iface = (d: Device, name = d.at) => d.ifaces.find((i) => i.name === name)!;
const isSvi = (i: Iface) => i.name.startsWith("Vlan");
/** An SVI is up when it isn't shut and its VLAN exists; a port when it isn't shut. */
const lineUp = (d: Device, i: Iface) => !i.shut && (!isSvi(i) || d.vlans.has(+i.name.slice(4)));

function stateChange(d: Device, i: Iface): string[] {
	if (i.shut) return [`%LINK-5-CHANGED: Interface ${i.name}, changed state to administratively down`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${i.name}, changed state to down`];
	const up = lineUp(d, i) ? "up" : "down";
	return [`%LINK-3-UPDOWN: Interface ${i.name}, changed state to ${up}`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${i.name}, changed state to ${up}`];
}

/* ---------- show ---------- */

const pad = (s: string, n: number) => s.padEnd(n);
const PORT_NAMES: Record<string, string> = { "20": "ftp-data", "21": "ftp", "23": "telnet", "25": "smtp", "53": "domain", "80": "www" };

const SHOW_HELP: Array<[string, string]> = [
	["access-lists", "List access lists"],
	["ip", "IP information (interface brief, route)"],
	["running-config", "Current operating configuration"],
	["vlan", "VTP VLAN status (brief)"],
];

function show(d: Device, p: Line): string[] {
	const what = p.word(["access-lists", "ip", "running-config", "vlan", "interfaces"]);
	if (what === "running-config") {
		p.end();
		return runningConfig(d);
	}
	if (what === "vlan") {
		p.word(["brief"]);
		p.end();
		const rows = [...d.vlans.entries()].sort((a, b) => a[0] - b[0]).map(([id, name]) => {
			const ports = d.ifaces.filter((i) => !isSvi(i) && (i.access ?? 1) === id && i.mode !== "trunk").map((i) => short(i.name));
			return `${pad(String(id), 5)}${pad(name, 11)}${pad("active", 10)}${ports.join(", ")}`.trimEnd();
		});
		return ["VLAN Name       Status    Ports", "---- ---------- --------- ------", ...rows];
	}
	if (what === "access-lists") {
		const only = p.more ? p.arg() : undefined;
		p.end();
		return [...d.acls.entries()]
			.filter(([n]) => !only || n === only)
			.flatMap(([n, rules]) => [`${+n < 100 ? "Standard" : "Extended"} IP access list ${n}`, ...rules.map((r, i) => `    ${(i + 1) * 10} ${r}`)]);
	}
	if (what === "interfaces") throw p.invalid(p.i - 1);
	const sub = p.word(["interface", "route"]);
	if (sub === "route") {
		p.end();
		if (!d.routing) return ["Default gateway is not set", "ICMP redirect cache is empty"];
		const connected = d.ifaces.filter((i) => isSvi(i) && i.ip && lineUp(d, i));
		return [
			"Codes: L - local, C - connected, S - static",
			"",
			"Gateway of last resort is not set",
			"",
			...connected.map((i) => `C    ${network(i.ip!, i.mask!)}/${prefix(i.mask!)} is directly connected, ${i.name}`),
		];
	}
	p.word(["brief"]);
	p.end();
	return [
		"Interface          IP-Address     OK? Method Status                Protocol",
		...d.ifaces.map((i) => {
			const status = i.shut ? "administratively down" : lineUp(d, i) ? "up" : "down";
			const proto = lineUp(d, i) ? "up" : "down";
			return `${pad(i.name, 19)}${pad(i.ip ?? "unassigned", 15)}YES ${pad(i.ip ? "manual" : "unset", 7)}${pad(status, 22)}${proto}`;
		}),
	];
}

function runningConfig(d: Device): string[] {
	const body: string[] = ["!", `hostname ${d.hostname}`, "!"];
	if (d.enableSecret) body.push(`enable secret 5 ${hash(d.enableSecret)}`, "!");
	for (const [name, secret] of d.users) body.push(`username ${name} secret 5 ${hash(secret)}`);
	if (d.users.size) body.push("!");
	if (d.routing) body.push("ip routing");
	if (d.domain) body.push(`ip domain-name ${d.domain}`);
	if (d.ssh2) body.push("ip ssh version 2");
	body.push("!");
	for (const [id, name] of [...d.vlans.entries()].sort((a, b) => a[0] - b[0])) if (id !== 1) body.push(`vlan ${id}`, ` name ${name}`, "!");
	for (const i of d.ifaces) {
		body.push(`interface ${i.name}`);
		if (i.description) body.push(` description ${i.description}`);
		if (i.mode) body.push(` switchport mode ${i.mode}`);
		if (i.access && i.access !== 1) body.push(` switchport access vlan ${i.access}`);
		body.push(i.ip ? ` ip address ${i.ip} ${i.mask}` : isSvi(i) ? " no ip address" : "");
		if (i.group) body.push(` ip access-group ${i.group.acl} ${i.group.dir}`);
		if (i.shut) body.push(" shutdown");
		body.push("!");
	}
	for (const [n, rules] of d.acls) for (const r of rules) body.push(`access-list ${n} ${r.replace(/ eq (\S+)$/, (_, p) => ` eq ${Object.entries(PORT_NAMES).find(([, v]) => v === p)?.[0] ?? p}`)}`);
	if (d.acls.size) body.push("!");
	body.push("line con 0", "line vty 0 4");
	if (d.vty.password) body.push(` password ${d.vty.password}`);
	if (d.vty.login) body.push(d.vty.login === "local" ? " login local" : " login");
	if (d.vty.transport) body.push(` transport input ${d.vty.transport}`);
	body.push("!", "end");
	const lines = body.filter((l) => l !== "");
	const bytes = lines.reduce((sum, l) => sum + l.length + 1, 0);
	return ["Building configuration...", "", `Current configuration : ${bytes} bytes`, ...lines];
}

/** A type-5-looking secret (never the secret itself). */
function hash(secret: string) {
	let h = 2166136261;
	for (const ch of secret) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
	const alphabet = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	let out = "";
	for (let k = 0; k < 22; k++) {
		h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
		out += alphabet[h % 64];
	}
	return `$1$jpl$${out}`;
}

/* ---------- ping ---------- */

function ping(d: Device, p: Line): string[] {
	const target = p.arg(isIp);
	p.end();
	const head = ["Type escape sequence to abort.", `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`];
	const up = d.ifaces.filter((i) => i.ip && lineUp(d, i));
	let marks = ".....";
	if (up.some((i) => i.ip === target)) marks = "!!!!!";
	else if (d.hosts.has(target) && up.some((i) => sameNet(i.ip!, target, i.mask!))) {
		marks = d.known.has(target) ? "!!!!!" : ".!!!!";
		d.known.add(target);
	}
	const ok = marks.split("!").length - 1;
	const tail = ok ? `Success rate is ${ok * 20} percent (${ok}/5), round-trip min/avg/max = 1/1/2 ms` : "Success rate is 0 percent (0/5)";
	return [...head, marks, tail];
}

/* ---------- modes ---------- */

const EXEC_HELP: Array<[string, string]> = [
	["configure", "Enter configuration mode"],
	["copy", "Copy from one file to another"],
	["disable", "Turn off privileged commands"],
	["enable", "Turn on privileged commands"],
	["exit", "Exit from the EXEC"],
	["ping", "Send echo messages"],
	["show", "Show running system information"],
	["write", "Write running configuration to memory"],
];
const CONFIG_HELP: Array<[string, string]> = [
	["access-list", "Add an access list entry"],
	["crypto", "Encryption module"],
	["do", "To run exec commands in config mode"],
	["enable", "Modify enable password parameters"],
	["end", "Exit from configure mode"],
	["exit", "Exit from configure mode"],
	["hostname", "Set system's network name"],
	["interface", "Select an interface to configure"],
	["ip", "Global IP configuration subcommands"],
	["line", "Configure a terminal line"],
	["no", "Negate a command or set its defaults"],
	["username", "Establish User Name Authentication"],
	["vlan", "VLAN commands"],
];
const IF_HELP: Array<[string, string]> = [
	["description", "Interface specific description"],
	["do", "To run exec commands in config mode"],
	["end", "Exit from configure mode"],
	["exit", "Exit from interface configuration mode"],
	["interface", "Select an interface to configure"],
	["ip", "Interface Internet Protocol config commands"],
	["no", "Negate a command or set its defaults"],
	["shutdown", "Shutdown the selected interface"],
	["switchport", "Set switching mode characteristics"],
];
const VLAN_HELP: Array<[string, string]> = [
	["do", "To run exec commands in config mode"],
	["end", "Exit from configure mode"],
	["exit", "Apply changes, bump revision number, and exit mode"],
	["name", "Ascii name of the VLAN"],
	["vlan", "VLAN commands"],
];
const LINE_HELP: Array<[string, string]> = [
	["do", "To run exec commands in config mode"],
	["end", "Exit from configure mode"],
	["exit", "Exit from line configuration mode"],
	["login", "Enable password checking"],
	["password", "Set a password"],
	["transport", "Define transport protocols for line"],
];

function helpFor(d: Device): Array<[string, string]> {
	if (d.mode === "user") return EXEC_HELP.filter(([w]) => ["enable", "exit", "ping", "show"].includes(w));
	if (d.mode === "priv") return EXEC_HELP.filter(([w]) => w !== "enable");
	return { config: CONFIG_HELP, if: IF_HELP, vlan: VLAN_HELP, line: LINE_HELP }[d.mode];
}
const list = (rows: Array<[string, string]>) => rows.map(([w, what]) => `  ${pad(w, 16)}${what}`);

const CONFIG_DONE = "%SYS-5-CONFIG_I: Configured from console by console";

function exec(d: Device, p: Line): string[] {
	const words = helpFor(d.mode === "user" || d.mode === "priv" ? d : { ...d, mode: "priv" }).map(([w]) => w);
	for (const w of ["enable", "logout", "wr"]) if (!words.includes(w)) words.push(w);
	const first = p.tokens[0];
	const hit = pick(first, words);
	if (hit === undefined && (d.mode === "user" || d.mode === "priv")) throw new Fail(["% Unknown command or computer name, or unable to find computer address"]);
	const cmd = p.word(words);
	switch (cmd) {
		case "enable":
			p.end();
			d.mode = "priv";
			return [];
		case "disable":
			p.end();
			d.mode = "user";
			return [];
		case "exit":
		case "logout":
			p.end();
			d.mode = "user";
			return [`${d.hostname} con0 is now available`, "", "Press RETURN to get started."];
		case "show":
			return show(d, p);
		case "ping":
			return ping(d, p);
		case "configure":
			if (d.mode === "user") throw p.invalid(0);
			if (p.more) p.word(["terminal"]);
			p.end();
			d.mode = "config";
			return ["Enter configuration commands, one per line.  End with CNTL/Z."];
		case "copy":
			p.word(["running-config"]);
			p.word(["startup-config"]);
			p.end();
			return ["Destination filename [startup-config]?", "Building configuration...", "[OK]"];
		case "write":
		case "wr":
			if (p.more) p.word(["memory"]);
			p.end();
			return ["Building configuration...", "[OK]"];
	}
	return [];
}

function config(d: Device, p: Line): string[] {
	// commands that work in every config mode
	const common = pick(p.tokens[0], ["do", "end", "exit", "interface", "vlan"]);
	if (common === "do") {
		p.i = 1;
		const inner = new Line(p.tokens.slice(1).join(" "), p.promptText + p.text.slice(0, p.starts[1] ?? p.text.length));
		const saved = d.mode;
		d.mode = "priv";
		try {
			return exec(d, inner);
		} finally {
			if (d.mode === "priv") d.mode = saved;
		}
	}
	if (common === "end") {
		p.i = 1;
		p.end();
		d.mode = "priv";
		d.at = undefined;
		return [CONFIG_DONE];
	}
	if (common === "exit") {
		p.i = 1;
		p.end();
		d.mode = d.mode === "config" ? "priv" : "config";
		d.at = undefined;
		return d.mode === "priv" ? [CONFIG_DONE] : [];
	}
	if (common === "interface") {
		p.i = 1;
		const name = ifaceName(p.rest());
		if (!name) throw p.invalid(1);
		if (!d.ifaces.some((i) => i.name === name)) d.ifaces.push({ name, shut: true });
		d.mode = "if";
		d.at = name;
		return [];
	}
	if (common === "vlan") {
		p.i = 1;
		const id = +p.arg(num(1, 4094));
		p.end();
		if (!d.vlans.has(id)) d.vlans.set(id, `VLAN${String(id).padStart(4, "0")}`);
		d.mode = "vlan";
		d.at = String(id);
		return [];
	}
	if (d.mode === "config") return global(d, p);
	try {
		return d.mode === "if" ? ifMode(d, p) : d.mode === "vlan" ? vlanMode(d, p) : lineMode(d, p);
	} catch (error) {
		// As IOS does: a global command typed in a sub-mode leaves the sub-mode and runs.
		const globalWord = pick(p.tokens[0], CONFIG_HELP.map(([w]) => w));
		if (!(error instanceof Fail) || !globalWord || globalWord === AMBIGUOUS || globalWord === "no") throw error;
		const saved = { mode: d.mode, at: d.at };
		d.mode = "config";
		d.at = undefined;
		p.i = 0;
		try {
			return global(d, p);
		} catch {
			Object.assign(d, saved);
			throw error;
		}
	}
}

function global(d: Device, p: Line): string[] {
	const words = CONFIG_HELP.map(([w]) => w);
	const negate = pick(p.tokens[0], words) === "no";
	if (negate) p.i = 1;
	const cmd = p.word(words);
	switch (cmd) {
		case "hostname": {
			const name = p.arg((s) => /^[A-Za-z][\w-]{0,62}$/.test(s));
			p.end();
			d.hostname = name;
			return [];
		}
		case "ip": {
			const what = p.word(["routing", "domain-name", "ssh"]);
			if (what === "routing") {
				p.end();
				d.routing = !negate;
				return [];
			}
			if (what === "domain-name") {
				if (negate) d.domain = undefined;
				else d.domain = p.arg((s) => /^[\w.-]+$/.test(s));
				p.end();
				return [];
			}
			p.word(["version"]);
			const v = p.arg((s) => s === "1" || s === "2");
			p.end();
			if (!d.rsa) return ["Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2)."];
			d.ssh2 = v === "2" && !negate;
			return [];
		}
		case "access-list": {
			const n = p.arg(num(1, 199));
			if (negate) {
				p.end();
				d.acls.delete(n);
				return [];
			}
			const action = p.word(["deny", "permit", "remark"]);
			const rest = p.rest();
			if (!rest.length) throw INCOMPLETE();
			if (action !== "remark" && +n >= 100 && !["ip", "tcp", "udp", "icmp"].includes(rest[0].toLowerCase())) throw p.invalid(3);
			const rule = [action, ...rest].join(" ").replace(/ eq (\d+)$/, (_, port) => ` eq ${PORT_NAMES[port] ?? port}`);
			d.acls.set(n, [...(d.acls.get(n) ?? []), rule]);
			return [];
		}
		case "crypto": {
			p.word(["key"]);
			p.word(["generate"]);
			p.word(["rsa"]);
			let bits = 1024;
			if (p.more) {
				p.word(["modulus"]);
				bits = +p.arg(num(360, 4096));
			}
			p.end();
			if (!d.domain) return ["% Please define a domain-name first."];
			d.rsa = bits;
			return [
				`The name for the keys will be: ${d.hostname}.${d.domain}`,
				`% The key modulus size is ${bits} bits`,
				`% Generating ${bits} bit RSA keys, keys will be non-exportable...`,
				"[OK]",
				"%SSH-5-ENABLED: SSH 1.99 has been enabled",
			];
		}
		case "username": {
			const name = p.arg((s) => /^[\w.-]{1,64}$/.test(s));
			p.word(["secret", "password"]);
			const secret = p.arg();
			p.end();
			d.users.set(name, secret);
			return [];
		}
		case "enable": {
			p.word(["secret"]);
			d.enableSecret = p.arg();
			p.end();
			return [];
		}
		case "line": {
			const kind = p.word(["vty", "console"]);
			p.arg(num(0, kind === "vty" ? 15 : 0));
			if (kind === "vty") p.arg(num(0, 15));
			p.end();
			d.mode = "line";
			d.at = kind;
			return [];
		}
	}
	throw p.invalid(0);
}

function ifMode(d: Device, p: Line): string[] {
	const i = iface(d);
	const words = IF_HELP.map(([w]) => w);
	const negate = pick(p.tokens[0], words) === "no";
	if (negate) p.i = 1;
	const cmd = p.word(words);
	switch (cmd) {
		case "shutdown": {
			p.end();
			const was = i.shut;
			i.shut = !negate;
			return was === i.shut ? [] : stateChange(d, i);
		}
		case "description":
			i.description = negate ? undefined : p.rest().join(" ") || undefined;
			return [];
		case "ip": {
			const what = p.word(["address", "access-group"]);
			if (what === "address") {
				if (!isSvi(i)) throw p.invalid(p.i - 1);
				if (negate) {
					p.end();
					i.ip = i.mask = undefined;
					return [];
				}
				const ip = p.arg(isIp);
				const mask = p.arg(isIp);
				p.end();
				if (!isMask(mask)) return [`Bad mask 0x${toInt(mask).toString(16).toUpperCase()} for address ${ip}`];
				const clash = d.ifaces.find((o) => o !== i && o.ip && sameNet(o.ip, ip, mask));
				if (clash) return [`% ${network(ip, mask)} overlaps with ${clash.name}`];
				i.ip = ip;
				i.mask = mask;
				return [];
			}
			const acl = p.arg(num(1, 199));
			const dir = p.word(["in", "out"]) as "in" | "out";
			p.end();
			i.group = negate ? undefined : { acl, dir };
			return [];
		}
		case "switchport": {
			if (isSvi(i)) throw p.invalid(p.i - 1);
			const what = p.word(["mode", "access"]);
			if (what === "mode") {
				i.mode = p.word(["access", "trunk"]) as "access" | "trunk";
				p.end();
				return [];
			}
			p.word(["vlan"]);
			const id = +p.arg(num(1, 4094));
			p.end();
			i.access = negate ? 1 : id;
			if (!negate && !d.vlans.has(id)) {
				d.vlans.set(id, `VLAN${String(id).padStart(4, "0")}`);
				return [`% Access VLAN does not exist. Creating vlan ${id}`];
			}
			return [];
		}
	}
	throw p.invalid(0);
}

function vlanMode(d: Device, p: Line): string[] {
	p.word(["name"]);
	const name = p.arg((s) => /^[\w.-]{1,32}$/.test(s));
	p.end();
	if (d.at === "1") return ["Default VLAN 1 may not have its name changed."];
	d.vlans.set(+d.at!, name);
	return [];
}

function lineMode(d: Device, p: Line): string[] {
	const words = LINE_HELP.map(([w]) => w).concat("no");
	const negate = pick(p.tokens[0], words) === "no";
	if (negate) p.i = 1;
	const cmd = p.word(words);
	if (d.at === "console") {
		p.rest();
		return [];
	}
	if (cmd === "transport") {
		p.word(["input"]);
		d.vty.transport = p.word(["ssh", "telnet", "all", "none"]);
		p.end();
		return [];
	}
	if (cmd === "login") {
		d.vty.login = negate ? undefined : p.more ? (p.word(["local"]) as "local") : "line";
		p.end();
		return [];
	}
	if (cmd === "password") {
		d.vty.password = negate ? undefined : p.arg();
		p.end();
		return [];
	}
	throw p.invalid(0);
}

/** Runs one typed line on the device and returns what IOS would print (the device changes in place). */
export function run(d: Device, input: string): string[] {
	const text = input.replace(/\s+$/, "").slice(0, 240);
	if (!text.trim()) return [];
	const p = new Line(text, prompt(d));
	// help: "?" alone, "show ?", or a start of a word with "?" ("sh?")
	if (text.endsWith("?")) {
		const before = text.slice(0, -1);
		const rows = helpFor(d);
		if (!before.trim()) return list(rows);
		if (/\s$/.test(before) && pick(before.trim().split(/\s+/)[0], ["show"]) === "show" && before.trim().split(/\s+/).length === 1) return list(SHOW_HELP);
		const start = before.trim().toLowerCase();
		const hits = rows.filter(([w]) => w.startsWith(start)).map(([w]) => w);
		return hits.length ? [hits.join("  ")] : ["% Unrecognized command"];
	}
	try {
		if (d.mode === "user" || d.mode === "priv") return exec(d, p);
		return config(d, p);
	} catch (error) {
		if (error instanceof Fail) return error.lines;
		throw error;
	}
}
