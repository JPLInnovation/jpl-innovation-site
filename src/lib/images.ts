/**
 * WebP copies of the large photos in public/assets, made by scripts/resize-images.mjs (widths must match).
 * The originals stay as `src` fallbacks and for "open full size" links.
 */
const copies: Record<string, number[]> = {
	"/assets/FRC.JPG": [640, 1280, 1920],
	"/assets/FRCnew.jpg": [640, 1280, 1920],
	"/assets/10951.jpg": [160, 400, 764],
	"/assets/Jayden_pfp.jpg": [160, 480, 900],
};

const copy = (src: string, width: number) => `${src.replace(/\.[^.]+$/, "")}-${width}.webp`;

/** `srcset` listing an image's WebP copies, so the browser downloads the size it shows. Undefined = no copies. */
export function srcset(src: string | undefined): string | undefined {
	const widths = src ? copies[src] : undefined;
	return widths?.map((w) => `${copy(src!, w)} ${w}w`).join(", ");
}

/** The largest WebP copy of an image (for canvas and 3D textures), or the image itself if it has none. */
export function largestCopy(src: string): string {
	const widths = copies[src];
	return widths ? copy(src, widths[widths.length - 1]) : src;
}
