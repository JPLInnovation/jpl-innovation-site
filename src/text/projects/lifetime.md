---
title: Lifetime
img: /assets/lifetime/server.webp
img_alt: Lifetime Server's fleet overview in the Glass style, with connected, offline and pending computers, daily awake hours and the device list
badge: Pilot deployments
description: |
  Windows software that measures how long each computer is really awake, and brings every computer in a school or
  office onto one dashboard. Open source, and deployed in Vietnam by COBACOM.
order: 5
---

## What it is

Lifetime has two parts. The **Lifetime desktop app** runs on each Windows computer and counts that computer's real awake time from inside the machine, not by guessing from network pings. **Lifetime Server** runs on one Windows server or PC, collects the data from every computer and shows them all on one dashboard.

It speaks Vietnamese and English, and comes in two styles (Glass and Classic) with light and dark themes. It's open source under the GPL-3.0 licence: [the code is on GitHub](https://github.com/jpl-innovation/Lifetime). [COBACOM](https://www.cobacom.com/vi) deploys and supports it for schools and offices in Vietnam.

![The Lifetime desktop app's Overview: total awake time, the current and longest sessions, and the last 14 days](/assets/lifetime/overview.webp)

## Counting you can trust

- Each computer counts its own awake time. If the network or the server goes down, it keeps counting and sends the data later.
- Time when the server itself was off is shown as **Unknown**, never counted as online or offline.
- Every computer gets a health score from 0 to 100, with the breakdown that explains it. A part with no data is Unknown, not counted as good or bad.

![The desktop app's Activity page: a calendar of awake hours, daily awake hours, the lifetime total and the hour-of-day profile](/assets/lifetime/activity.webp)

## One dashboard for the whole fleet

- The Overview counts the computers that are Online, Offline, have no report yet, or are waiting for approval. Click any of them to see which computers they are.
- The device list has status chips, a 24-hour online timeline, and CPU and RAM trends.
- Each device has its own page: its hardware (CPU, RAM, disks with capacity bars, battery), an activity and health summary, and its events.
- Alert rules, expected-online hours, maintenance windows, an incident list with acknowledge, and email alerts over secure SMTP (STARTTLS). An optional HTTPS webhook can feed chat tools through a bridge.
- Monthly availability reports as PDF and CSV, for one computer, a group or the whole site, keeping awake time, availability and Unknown time apart.
- Network checks for printers, routers and websites (ping, TCP port, HTTP), with nothing installed on them.

![A device's page on Lifetime Server: its hardware, activity, health and events](/assets/lifetime/server-device.webp)

## Safe to run

- Remote Sleep, Restart, Shut down and Turn on (Wake-on-LAN), one computer at a time, and only if its owner has allowed remote power control. Every action is logged, rate-limited and limited by role.
- Windows accounts with four roles (Admin, Operator, Auditor, Viewer), access denied by default, and a tamper-evident audit log.
- Computers join with a one-time code, or are installed silently on many at once (GPO or Intune). New computers wait for an admin's approval.
- Encrypted connections (TLS with certificate pinning) with certificates that renew themselves; backup, verify and restore; opt-in, staged updates for the agents; and a server that runs as a Windows service and restarts itself.
- Light on resources: in testing, the server used about 1.8% CPU and about 61 MB of memory with 50 simulated computers.

## Privacy

Each computer's owner or user chooses what to share with sharing switches, and nothing beyond that is sent. Lifetime never records screens, keystrokes, browsing or file contents: only awake time, device health and hardware information. All the data stays on the customer's own server, on their own network. There is no cloud service.

## Coming in version 1.2.0

Development is finished; version 1.2.0 will be released after a short test round. It adds:

- **Energy and cost**: kWh and money (in VND by default, with an editable price per kWh) worked out from real awake hours. Measured where a computer reports real power readings, and estimated from a typical wattage the admin sets otherwise.
- **Left on after hours**: which computers stayed awake outside school or office hours, and how much energy and money that wasted. An optional per-group policy sends the normal Sleep command only to computers whose owner allowed it, and stops if someone is using the computer.
- **Replacement plan**: when each battery wears out and each disk fills up, forecast from that computer's own history, or "not enough data" when there is too little.

## Where it is now

The current public version is 1.1.0. Pilot deployments, with testing on real customer machines in progress. The server runs on Windows Server or a Windows 10/11 PC; the computers run Windows 10/11.
