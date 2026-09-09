import { normalizeAzure, normalizeJira, normalizeTrello } from "./normalize.js";
import { analyzeTicket } from "./index.js";
import type { AzureWorkItemResult } from "../azure.js";
import type { JiraIssueResult } from "../jira.js";
import type { TrelloCardResult } from "../trello.js";

const jiraIssue: JiraIssueResult = {
  key: "PROJ-1", summary: "Agregar login con Google", issueType: "Story",
  status: "To Do", priority: "High", assignee: "Ana", labels: ["auth"],
  components: ["web"], description: "Permitir login con Google.",
  comments: [{ author: "Bob", date: "2026-06-01T00:00:00Z", text: "ok" }],
  attachments: [], subtasks: [{ key: "PROJ-2", summary: "UI", status: "To Do" }],
  parent: null, sprint: "Sprint 1", epic: "Auth",
};

const trelloCard: TrelloCardResult = {
  name: "Fix crash al guardar", description: "La app crashea.", list: "Doing",
  labels: ["red: Blocker"], due: null, members: ["Ana"],
  comments: [{ author: "Bob", date: "2026-06-01T00:00:00Z", text: "repro" }],
  checklists: [{ name: "QA", items: [{ text: "probar", done: false }] }],
  attachments: [],
};

test("normalizeJira maps key/summary/type and metadata", () => {
  const ticket = normalizeJira(jiraIssue);
  expect(ticket.source).toBe("jira");
  expect(ticket.id).toBe("PROJ-1");
  expect(ticket.title).toBe("Agregar login con Google");
  expect(ticket.type).toBe("Story");
  expect(ticket.metadata.sprint).toBe("Sprint 1");
  expect(ticket.metadata.subtasks?.[0].key).toBe("PROJ-2");
  expect(ticket.comments[0].author).toBe("Bob");
});

test("normalizeTrello flattens checklists and sets source", () => {
  const ticket = normalizeTrello(trelloCard, "card123");
  expect(ticket.source).toBe("trello");
  expect(ticket.id).toBe("card123");
  expect(ticket.title).toBe("Fix crash al guardar");
  expect(ticket.type).toBeNull();
  expect(ticket.checklistItems).toEqual([{ text: "probar", done: false }]);
  expect(ticket.labels).toEqual(["red: Blocker"]);
});

test("normalizeAzure preserves child repro steps as analysis evidence", () => {
  const workItem: AzureWorkItemResult = {
    id: 1596, title: "Parent", workItemType: "User Story", state: "Active", reason: null,
    priority: null, assignee: null, createdBy: null, storyPoints: null, remainingWork: null,
    tags: [], iterationPath: null, areaPath: null, description: "", acceptanceCriteria: "",
    reproSteps: "", comments: [], attachments: [], url: "https://example.test/1596",
    children: [{
      id: 1660, title: "Child bug", workItemType: "Bug", state: "Active", reason: null,
      priority: null, assignee: null, createdBy: null, storyPoints: null, remainingWork: null,
      tags: [], iterationPath: null, areaPath: null, description: "", acceptanceCriteria: "",
      reproSteps: "Al abrir el perfil, la aplicación crashea.", comments: [], attachments: [],
      children: [], url: "https://example.test/1660",
    }],
    parent: null, related: [], truncated: false, nodeCount: 2,
  };

  const ticket = normalizeAzure(workItem);
  expect(ticket.metadata.children?.[0]).toMatchObject({
    reproSteps: "Al abrir el perfil, la aplicación crashea.",
  });
  const analysis = analyzeTicket(ticket);
  expect(analysis.ticketType.type).toBe("bug");
  expect(analysis.ticketType.evidence).toContain("crash");
});
