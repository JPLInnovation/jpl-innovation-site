/**
 * LIFETIME PAGE TEXT (/work/lifetime/): the live demo's words, the title block and the labels around the write-up.
 *
 * Edit the words between the quotes. Keep the quotes, the {placeholders} and the commas at the end of lines.
 *   - The page title, intro sentence and the write-up (every section, the pictures, 1.2.0): src/text/projects/lifetime.md
 *   - The case at the top (problem, alternatives, answer, COBACOM): the `lifetime` entry in src/text/projects/hooks.ts
 *   - The simulated day itself (lessons, the outage, the new computer): src/lib/look/lifetime-day.ts
 */

export const lifetimePage = {
	/** The drawing's title block, under the page title. Links open in a new tab. */
	titleBlock: {
		label: "Title block",
		rows: [
			{ label: "Project", value: "Lifetime" },
			{ label: "Kind", value: "Windows software" },
			{ label: "Status", value: "Pilot deployments" },
			{ label: "Public version", value: "1.1.0" },
			{ label: "Next", value: "1.2.0, after a short test round" },
			{ label: "Licence", value: "GPL-3.0, open source" },
			{ label: "Partner", value: "COBACOM", href: "https://www.cobacom.com/vi" },
			{ label: "Code", value: "On GitHub", href: "https://github.com/jpl-innovation/Lifetime" },
		],
	},

	/** The live demo: one school day on Lifetime Server, run by the scroll. */
	demo: {
		heading: "One school day, as the server sees it",
		intro:
			"A computer lab with 22 computers, from six in the morning to six in the evening. Scroll and the day runs: computers wake for lessons and sleep after them, a new one joins, and at 10:30 the server goes down for two hours.",
		/** The one plain caption that says what this is. */
		caption: "A simulation of the Lifetime Server interface, built in HTML for this page. The lab and its numbers are made up: no customer's data.",
		/** Read by screen readers for the app window. */
		windowLabel: "Simulated Lifetime Server window",
		controls: {
			time: "Time of day",
			style: "Style",
			glass: "Glass",
			classic: "Classic",
			theme: "Theme",
			dark: "Dark",
			light: "Light",
			/** In the 3D studio's monitor: runs the day on its own. */
			play: "Play the day",
			pause: "Pause",
		},
		plan: {
			label: "Plan of the lab: 21 desks in three rows, the teacher's desk and the server cabinet. A lit screen is an awake computer. Use the arrow keys to pick a computer.",
			server: "Server",
			serverOff: "Server off",
			teacher: "Teacher",
			awake: "awake",
			asleep: "asleep",
			empty: "empty desk",
		},
		/** The two strips under the plan: the picked computer's own count against what the server saw. */
		compare: {
			computer: "Counted on {name}",
			server: "Seen by the server",
			awake: "Awake",
			online: "Online",
			unknown: "Unknown",
		},
		/** Shown while the server is down: awake time the computers counted and still hold. */
		queued: "Counted on the computers, not sent yet: {queued}",
		/** What the story says as the day goes by. `from` is the time it starts showing (24-hour clock). */
		beats: [
			{
				from: "06:00",
				text: "Before school. Every computer in the lab is asleep, so the server lists all 21 as Offline: not heard from since yesterday.",
			},
			{ from: "06:50", text: "The first lesson. Each computer wakes and starts counting its own awake time, from inside the machine." },
			{ from: "09:05", text: "A new computer is set up on the last desk. It joins with a one-time code and waits for an admin's approval." },
			{ from: "10:30", text: "10:30, and the server goes down. The lab carries on, and every computer keeps counting on its own." },
			{
				from: "12:30",
				text: "12:30, and the server is back. Each computer sends what it counted the next time it is awake. The two hours the server was off are Unknown: not guessed as online, not guessed as offline.",
			},
			{ from: "12:40", text: "The admin approves the new computer. It shows No report yet until it wakes for the next lesson and reports." },
			{ from: "13:20", text: "Afternoon lessons. Pick a computer on the plan, a row in the list or one of the counts to see which computers it is." },
			{
				from: "17:30",
				text: "The end of the day: {hours} of awake time across {count} computers, every minute counted on the computers themselves, and the server's two hours off kept apart as Unknown.",
			},
		],
	},

	/** The real screenshots, after the demo. Each picture's description is its alt text. */
	plates: {
		heading: "The real screens",
		intro: "The demo above is HTML. These are Lifetime itself.",
		extra: [
			{
				src: "/assets/lifetime/server.webp",
				alt: "Lifetime Server's Fleet overview in the Glass style, dark theme: connected, offline, awake today and pending approval, the Online now gauge, daily awake hours for the last 7 days and the device list, with the product's own demo computers",
			},
		],
	},

	/** The revision mark beside "Coming in version 1.2.0" (a drawing's mark for changes in the next revision). */
	revision: "1.2.0",
};

/**
 * The simulated window's own words, in the product's two languages: the real Lifetime Server strings and their real
 * Vietnamese translations (from the product's lifetime_i18n.py). The EN button in the window switches between them.
 */
export const lifetimeUi = {
	en: {
		lang: "EN",
		app: "Lifetime Server",
		where: "Demo-Server · Local network",
		nav: ["Overview", "Devices", "Administration", "This Server"],
		running: "Server running",
		stopped: "Server stopped",
		updated: "Updated {time}",
		refresh: "Refresh",
		title: "Fleet overview",
		today: "Today",
		exportReport: "Export report",
		addDevice: "Add device",
		connected: "Connected",
		ofComputers: "of {count} computers",
		offline: "Offline",
		notHeard: "Not heard from recently",
		awakeToday: "Awake today",
		reporting: "{count} reporting devices",
		pending: "Pending approval",
		reviewRequired: "Administrator review required",
		review: "Review",
		onlineNow: "Online now",
		gaugeNote: "{connected} of {total} computers online",
		daily: "Daily awake hours",
		last7: "Last 7 days",
		dailyNote: "Known daily contributions only · device-local dates",
		days: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Today"],
		devices: "Devices",
		search: "Search devices",
		allGroups: "All groups",
		columns: { device: "Device", group: "Group", status: "Status", awake: "Awake today", timeline: "24 h" },
		groups: { lab: "Lab", teacher: "Teacher" },
		states: { online: "Online", offline: "Offline", noreport: "No report yet", pending: "Pending approval", unknown: "Unknown" },
		rowStatus: { online: "Connected", offline: "Offline", noreport: "No report yet", pending: "Pending approval" },
		notAvailable: "Not available",
		duration: "{hours} h {minutes} m",
		showing: "Showing {start} to {end} of {total} devices",
		previous: "Previous",
		next: "Next",
		details: "Device details",
		detailsHint: "Select a device to view its recorded usage.",
		openDevice: "Open device",
		events: "Recent events",
		eventKinds: { synchronized: "Synchronized", offline: "Went offline", awaiting: "Awaiting approval" },
	},
	vi: {
		lang: "VI",
		app: "Lifetime Server",
		where: "Demo-Server · Mạng nội bộ",
		nav: ["Tổng quan", "Thiết bị", "Quản trị", "Máy chủ này"],
		running: "Máy chủ đang chạy",
		stopped: "Máy chủ đã dừng",
		updated: "Cập nhật lúc {time}",
		refresh: "Làm mới",
		title: "Tổng quan thiết bị",
		today: "Hôm nay",
		exportReport: "Xuất báo cáo",
		addDevice: "Thêm thiết bị",
		connected: "Đã kết nối",
		ofComputers: "trên {count} máy tính",
		offline: "Ngoại tuyến",
		notHeard: "Lâu rồi chưa nhận tin",
		awakeToday: "Chạy hôm nay",
		reporting: "{count} thiết bị có dữ liệu",
		pending: "Chờ phê duyệt",
		reviewRequired: "Cần quản trị viên xét duyệt",
		review: "Xem xét",
		onlineNow: "Đang trực tuyến",
		gaugeNote: "{connected} trên {total} máy tính đang trực tuyến",
		daily: "Thời gian hoạt động mỗi ngày",
		last7: "7 ngày qua",
		dailyNote: "Chỉ tính dữ liệu đã nhận · theo ngày trên từng máy",
		days: ["T7", "CN", "T2", "T3", "T4", "T5", "Hôm nay"],
		devices: "Thiết bị",
		search: "Tìm thiết bị",
		allGroups: "Tất cả nhóm",
		columns: { device: "Máy tính", group: "Nhóm", status: "Trạng thái", awake: "Chạy hôm nay", timeline: "24 giờ" },
		groups: { lab: "Phòng máy", teacher: "Giáo viên" },
		states: { online: "Trực tuyến", offline: "Ngoại tuyến", noreport: "Chưa có báo cáo", pending: "Chờ phê duyệt", unknown: "Chưa xác định" },
		rowStatus: { online: "Đã kết nối", offline: "Ngoại tuyến", noreport: "Chưa có báo cáo", pending: "Chờ phê duyệt" },
		notAvailable: "Chưa có dữ liệu",
		duration: "{hours} giờ {minutes} phút",
		showing: "Hiển thị {start} đến {end} trên {total} thiết bị",
		previous: "Trước",
		next: "Tiếp tục",
		details: "Chi tiết thiết bị",
		detailsHint: "Chọn thiết bị để xem thời gian chạy đã ghi nhận.",
		openDevice: "Mở thiết bị",
		events: "Sự kiện gần đây",
		eventKinds: { synchronized: "Đã đồng bộ", offline: "Đã ngoại tuyến", awaiting: "Đang chờ duyệt" },
	},
};
