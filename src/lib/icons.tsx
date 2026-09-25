import {
	CalendarDays,
	CircleCheck,
	Cpu,
	Crosshair,
	PencilLine,
	Rocket,
	SignalHigh,
	SquareTerminal,
	Users,
	Video,
	Zap,
	type LucideProps,
} from "lucide-react";

/** Icon names used in src/data/*.ts, mapped to lucide icons. */
const icons = {
	"rocket-launch": Rocket,
	lightning: Zap,
	target: Crosshair,
	"video-camera": Video,
	"cell-signal": SignalHigh,
	cpu: Cpu,
	"terminal-window": SquareTerminal,
	calendar: CalendarDays,
	users: Users,
	"pencil-line": PencilLine,
	"check-circle": CircleCheck,
} as const;

export type IconName = keyof typeof icons;

export function DataIcon({ name, ...props }: { name: IconName } & LucideProps) {
	const Component = icons[name];
	return <Component aria-hidden="true" {...props} />;
}
