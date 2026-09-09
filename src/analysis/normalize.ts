import type { JiraIssueResult } from "../jira.js";
import type { TrelloCardResult } from "../trello.js";
import type { AzureWorkItemNode, AzureWorkItemResult } from "../azure.js";
import type { NormalizedTicket } from "./types.js";

export function normalizeJira(issue: JiraIssueResult): NormalizedTicket {
  return {
    source: "jira", id: issue.key, title: issue.summary, description: issue.description,
    type: issue.issueType ?? null, status: issue.status ?? null, labels: issue.labels,
    comments: issue.comments.map((c) => ({ author: c.author, date: c.date, text: c.text })),
    checklistItems: [],
    metadata: {
      priority: issue.priority, assignee: issue.assignee, components: issue.components,
      sprint: issue.sprint, epic: issue.epic, subtasks: issue.subtasks,
      attachments: issue.attachments.map((a) => ({ name: a.name, mimeType: a.mimeType })),
    },
  };
}

export function normalizeTrello(card: TrelloCardResult, id: string): NormalizedTicket {
  return {
    source: "trello", id, title: card.name, description: card.description, type: null,
    status: card.list, labels: card.labels,
    comments: card.comments.map((c) => ({ author: c.author, date: c.date, text: c.text })),
    checklistItems: card.checklists.flatMap((cl) => cl.items.map((i) => ({ text: i.text, done: i.done }))),
    metadata: {
      members: card.members, due: card.due,
      attachments: card.attachments.map((a) => ({ name: a.name, mimeType: a.mimeType })),
    },
  };
}

function isDone(state: string): boolean {
  return /^(closed|done|completed|resolved|removed|canceled|cancelled)$/i.test(state.trim());
}

function flattenChildren(node: AzureWorkItemNode): AzureWorkItemNode[] {
  return node.children.flatMap((child) => [child, ...flattenChildren(child)]);
}

export function normalizeAzure(workItem: AzureWorkItemResult): NormalizedTicket {
  const children = flattenChildren(workItem).map((child) => ({
    id: child.id,
    title: child.title,
    type: child.workItemType,
    status: child.state,
    done: isDone(child.state),
    description: child.description,
    acceptanceCriteria: child.acceptanceCriteria,
    reproSteps: child.reproSteps,
    comments: child.comments.map((c) => ({ author: c.author, date: c.date, text: c.text })),
    attachments: child.attachments.map((a) => ({ name: a.name, mimeType: a.mimeType })),
  }));

  const rootAttachments = workItem.attachments.map((a) => ({ name: a.name, mimeType: a.mimeType }));
  const checklistItems = children.map((child) => ({
    text: `${child.type || "Work item"} ${child.id}: ${child.title}`,
    done: child.done,
  }));

  return {
    source: "azure",
    id: String(workItem.id),
    title: workItem.title,
    description: [workItem.description, workItem.acceptanceCriteria, workItem.reproSteps]
      .filter(Boolean).join("\n\n"),
    type: workItem.workItemType || null,
    status: workItem.state || null,
    labels: workItem.tags,
    comments: workItem.comments.map((c) => ({ author: c.author, date: c.date, text: c.text })),
    checklistItems,
    metadata: {
      priority: workItem.priority,
      assignee: workItem.assignee,
      components: workItem.areaPath ? [workItem.areaPath] : [],
      children,
      attachments: rootAttachments,
      parent: workItem.parent,
      related: workItem.related,
      truncated: workItem.truncated,
      nodeCount: workItem.nodeCount,
    },
  };
}
