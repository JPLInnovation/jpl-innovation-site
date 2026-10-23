/**
 * Hands the main thread back to the browser for a moment, so a long build (the studio's room) is done in slices: a
 * frame can be drawn and a click answered between them, instead of the page freezing for the whole build. That is what
 * keeps a page change smooth when the next page builds a 3D scene while the old one is still fading out.
 */
type WithScheduler = { scheduler?: { yield?: () => Promise<void> } };

const channel = typeof MessageChannel === "undefined" ? undefined : new MessageChannel();
const waiting: Array<() => void> = [];
if (channel) channel.port1.onmessage = () => waiting.splice(0).forEach((resolve) => resolve());

export function tick(): Promise<void> {
	const scheduler = (globalThis as WithScheduler).scheduler;
	if (scheduler?.yield) return scheduler.yield();
	return new Promise((resolve) => {
		if (!channel) {
			setTimeout(resolve, 0);
			return;
		}
		waiting.push(resolve);
		channel.port2.postMessage(0);
	});
}
