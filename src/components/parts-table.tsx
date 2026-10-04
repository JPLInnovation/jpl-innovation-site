import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dronePage } from "@/text/projects/drone";
import { formatVnd } from "@/lib/format";

export interface Part {
	name: string;
	why: string;
	price?: number;
}

interface Labels {
	part: string;
	why: string;
	price: string;
	notPriced: string;
	subtotal: string;
}

/**
 * One project's part group as a table. Rendered at build time; no client JS.
 * A group with no prices at all (e.g. the mini drone) gets no Price column and no subtotal row.
 */
export default function PartsTable({
	caption,
	parts,
	subtotal,
	labels = dronePage.table,
}: {
	caption: string;
	parts: Part[];
	subtotal: number;
	/** Column labels; defaults to the F450 drone page's (every project's labels are the same English words). */
	labels?: Labels;
}) {
	const priced = parts.some((p) => p.price !== undefined);
	return (
		<Table className="text-[15px]">
			<caption className="sr-only">{caption}</caption>
			<TableHeader>
				<TableRow>
					<TableHead className="w-[40%]">{labels.part}</TableHead>
					<TableHead className="hidden md:table-cell">{labels.why}</TableHead>
					{priced && <TableHead className="text-right">{labels.price}</TableHead>}
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
						{priced && (
							<TableCell className="text-right align-top tabular-nums">
								{p.price === undefined ? <span className="text-muted-foreground">{labels.notPriced}</span> : formatVnd(p.price)}
							</TableCell>
						)}
					</TableRow>
				))}
			</TableBody>
			{priced && (
				<TableFooter>
					<TableRow>
						<TableCell className="font-semibold">{labels.subtotal}</TableCell>
						<TableCell className="hidden md:table-cell" />
						<TableCell className="text-right font-semibold tabular-nums">{formatVnd(subtotal)}</TableCell>
					</TableRow>
				</TableFooter>
			)}
		</Table>
	);
}
