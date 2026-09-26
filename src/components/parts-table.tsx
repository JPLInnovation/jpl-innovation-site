import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dronePage, type Part } from "@/text/projects/drone";
import { formatVnd } from "@/lib/format";

const t = dronePage.table;

/** One drone part group as a table. Rendered at build time; no client JS. */
export default function PartsTable({ caption, parts, subtotal }: { caption: string; parts: Part[]; subtotal: number }) {
	return (
		<Table className="text-[15px]">
			<caption className="sr-only">{caption}</caption>
			<TableHeader>
				<TableRow>
					<TableHead className="w-[40%]">{t.part}</TableHead>
					<TableHead className="hidden md:table-cell">{t.why}</TableHead>
					<TableHead className="text-right">{t.price}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{parts.map((p) => (
					<TableRow key={p.name}>
						<TableCell className="align-top whitespace-normal">
							<span className="font-medium">{p.name}</span>
							<span className="mt-1 block text-sm text-muted-foreground md:hidden">{p.why}</span>
						</TableCell>
						<TableCell className="hidden align-top whitespace-normal text-muted-foreground md:table-cell">{p.why}</TableCell>
						<TableCell className="text-right align-top tabular-nums">
							{p.price === undefined ? <span className="text-muted-foreground">{t.notPriced}</span> : formatVnd(p.price)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
			<TableFooter>
				<TableRow>
					<TableCell className="font-semibold">{t.subtotal}</TableCell>
					<TableCell className="hidden md:table-cell" />
					<TableCell className="text-right font-semibold tabular-nums">{formatVnd(subtotal)}</TableCell>
				</TableRow>
			</TableFooter>
		</Table>
	);
}
