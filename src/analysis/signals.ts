import type { NormalizedTicket, TicketSignals } from "./types.js";

export function deriveSignals(ticket: NormalizedTicket): TicketSignals {
  const parts = [
    ticket.title,
    ticket.description,
    ...ticket.comments.map((c) => c.text),
    ...ticket.checklistItems.map((i) => i.text),
    ...ticket.labels,
    ...(ticket.metadata.children ?? []).flatMap((child) => [
      child.title,
      child.description,
      child.acceptanceCriteria,
      child.reproSteps ?? "",
      ...child.comments.map((c) => c.text),
      ...child.attachments.map((a) => a.name),
    ]),
    ...(ticket.metadata.attachments ?? []).map((a) => a.name),
  ];
  const fullText = parts.join(" \n ").toLowerCase();
  const tokens = new Set(fullText.split(/[^a-z0-9áéíóúñ]+/i).filter(Boolean));
  return { fullText, tokens };
}

export function countHits(signals: TicketSignals, terms: string[]): string[] {
  return terms.filter((term) => {
    const t = term.toLowerCase();
    if (t.includes(" ")) return signals.fullText.includes(t);
    return signals.tokens.has(t) || signals.fullText.includes(t);
  });
}
