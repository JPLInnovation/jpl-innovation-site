import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Model, StageContext, StageView } from "@/lib/three/stage";
import { cn } from "@/lib/utils";

/** What every file in src/lib/three/models exports. */
interface ModelModule {
	default: (ctx: StageContext, options: Record<string, unknown>) => Model | Promise<Model>;
	/** Camera setup, fixed or derived from the options. */
	view: StageView | ((options: Record<string, unknown>) => StageView);
}

/**
 * A 3D model on a <canvas>, loaded only when this island hydrates (use `client:visible`).
 * Three.js and the model code are fetched on demand, so pages without models never download them.
 *
 * `children` is the fallback: shown during loading, without JavaScript, or when WebGL is unavailable.
 * Pass the page's existing image/illustration there so nothing is lost.
 */
const models = {
	"frc-robot": () => import("@/lib/three/models/frc-robot"),
	drone: () => import("@/lib/three/models/drone"),
	network: () => import("@/lib/three/models/network"),
	badges: () => import("@/lib/three/models/badges"),
};

export type ModelName = keyof typeof models;

interface Props {
	model: ModelName;
	/** Accessible description of what the model shows. */
	label: string;
	/** Model-specific settings (must be plain JSON). */
	options?: Record<string, unknown>;
	/** Show a "Drag to rotate" hint on mouse/trackpad devices. */
	hint?: boolean;
	className?: string;
	children?: ReactNode;
}

export default function ModelViewer({ model, label, options, hint = true, className, children }: Props) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

	useEffect(() => {
		let cancelled = false;
		let dispose: (() => void) | undefined;
		Promise.all([import("@/lib/three/stage"), models[model]()])
			.then(async ([stage, loaded]) => {
				if (cancelled || !wrapRef.current || !canvasRef.current) return;
				const mod = loaded as unknown as ModelModule;
				const settings = options ?? {};
				dispose = await stage.mountStage(
					wrapRef.current,
					canvasRef.current,
					(ctx) => mod.default(ctx, settings),
					typeof mod.view === "function" ? mod.view(settings) : mod.view,
				);
				if (cancelled) dispose();
				else setState("ready");
			})
			.catch((error) => {
				console.warn(`3D model "${model}" unavailable, showing the fallback.`, error);
				if (!cancelled) setState("failed");
			});
		return () => {
			cancelled = true;
			dispose?.();
		};
		// Options are static per page; re-mounting on identity changes would thrash the GPU.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [model]);

	const ready = state === "ready";
	return (
		<div ref={wrapRef} className={cn("relative isolate", className)}>
			<canvas
				ref={canvasRef}
				role="img"
				aria-label={label}
				className={cn(
					"absolute inset-0 size-full transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
					ready ? "opacity-100" : "opacity-0",
				)}
			/>
			{children && (
				<div
					aria-hidden={ready || undefined}
					className={cn(
						"absolute inset-0 flex items-center justify-center transition-opacity duration-500",
						ready && "pointer-events-none opacity-0",
					)}
				>
					{children}
				</div>
			)}
			{ready && hint && (
				<p className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full border bg-card/85 px-3 py-1 text-xs font-medium text-muted-foreground [@media(pointer:fine)]:block">
					Drag to rotate
				</p>
			)}
		</div>
	);
}
