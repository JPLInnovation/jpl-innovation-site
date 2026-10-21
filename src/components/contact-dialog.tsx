import { useState } from "react";
import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { emailPopup as text, site } from "@/text/site";
import { cn } from "@/lib/utils";

const EMAIL = site.email;

type Props = {
	/** Pre-filled email subject. */
	subject?: string;
	/** Text on the button that opens the dialog. */
	label?: string;
	/** How the opening button looks. "inverse" is a white button for coloured backgrounds. */
	look?: "ink" | "signal" | "link" | "inverse";
	className?: string;
};

/**
 * Contact button + dialog. A plain mailto: link does nothing on computers without a mail app,
 * so this offers the address to copy, Gmail in the browser, and the mail app.
 */
export default function ContactDialog({
	subject = text.defaultSubject,
	label = text.defaultButton,
	look = "ink",
	className,
}: Props) {
	const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
	const encoded = encodeURIComponent(subject);
	const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}&su=${encoded}`;
	const mailto = `mailto:${EMAIL}?subject=${encoded}`;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(EMAIL);
			setCopied("done");
		} catch {
			setCopied("failed");
		}
		window.setTimeout(() => setCopied("idle"), 2200);
	};

	return (
		<Dialog onOpenChange={() => setCopied("idle")}>
			<DialogTrigger asChild>
				{look === "link" ? (
					<button
						type="button"
						className={cn(
							"press inline-flex min-h-11 cursor-pointer items-center text-left underline-offset-4 hover:text-foreground hover:underline",
							className,
						)}
					>
						{label}
					</button>
				) : (
					<Button
						size="lg"
						variant={look === "signal" ? "signal" : "default"}
						className={cn(
							look === "ink" && "bg-primary text-primary-foreground hover:bg-primary/90",
							look === "inverse" &&
								"bg-white font-semibold text-[#1d4ed8] shadow-[var(--shadow-soft)] hover:-translate-y-px hover:bg-white/95 focus-visible:ring-white/60",
							className,
						)}
					>
						<Mail aria-hidden="true" /> {label}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="gap-6 rounded-2xl p-6 sm:max-w-md sm:p-8">
				<DialogHeader className="gap-2 text-left">
					<DialogTitle className="font-wide text-2xl font-[850]">{text.title}</DialogTitle>
					<DialogDescription className="text-[15px]">
						{text.description}
					</DialogDescription>
				</DialogHeader>

				<div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/60 py-2 pl-4 pr-2">
					<span className="truncate font-medium select-all">{EMAIL}</span>
					<Button variant="secondary" size="sm" onClick={copy} className="shrink-0" aria-live="polite">
						{copied === "done" ? (
							<>
								<Check aria-hidden="true" /> {text.copied}
							</>
						) : (
							<>
								<Copy aria-hidden="true" /> {text.copy}
							</>
						)}
					</Button>
				</div>
				{copied === "failed" && (
					<p className="-mt-3 text-sm text-destructive" role="status">
						{text.copyFailed}
					</p>
				)}

				<div className="flex flex-col gap-2 sm:flex-row">
					<Button asChild variant="signal" size="lg" className="flex-1">
						<a href={gmail} target="_blank" rel="noopener noreferrer">
							{text.openGmail} <ExternalLink aria-hidden="true" />
						</a>
					</Button>
					<Button asChild variant="outline" size="lg" className="flex-1">
						<a href={mailto}>{text.openMailApp}</a>
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
