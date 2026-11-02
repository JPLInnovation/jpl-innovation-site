/**
 * The drone's tools (build guide, 3D layout, Camera POV, camera mount) are pages of their own outside the site's frame:
 * they open in a new browser tab, wherever the link to them is (text, cards, the 3D studio, React islands), so the site
 * stays where it was. Set just before the click reaches the page router, which leaves links with a target alone.
 */
const TOOL = /^\/work\/drone\/(build-guide|3d-layout|camera-pov|camera-mount)(\/|$)/;

document.addEventListener(
	"click",
	(event) => {
		const link = (event.target as Element).closest?.<HTMLAnchorElement>("a[href]");
		if (!link || link.origin !== location.origin || !TOOL.test(link.pathname)) return;
		link.target = "_blank";
		link.rel = "noopener";
	},
	true,
);

export {};
