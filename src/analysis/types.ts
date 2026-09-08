export type TicketType =
  | "feature" | "bug" | "refactor" | "technical_debt"
  | "spike" | "infrastructure" | "security" | "performance";

export type Severity = "low" | "medium" | "high";

export type RiskCategory =
  | "auth" | "payments" | "security" | "database"
  | "infrastructure" | "data-loss" | "external-provider";

export type ComplexityLevel = "S" | "M" | "L" | "XL";

export interface NormalizedTicket {
  source: "jira" | "trello" | "azure";
  id: string;
  title: string;
  description: string;
  type: string | null;
  status: string | null;
  labels: string[];
  comments: { author: string; date: string; text: string }[];
  checklistItems: { text: string; done: boolean }[];
  metadata: {
    priority?: string | number | null;
    assignee?: string | null;
    members?: string[];
    components?: string[];
    sprint?: string | null;
    epic?: string | null;
    due?: string | null;
    subtasks?: { key: string; summary: string; status: string }[];
    children?: {
      id: number;
      title: string;
      type: string;
      status: string;
      done: boolean;
      description: string;
      acceptanceCriteria: string;
      comments: { author: string; date: string; text: string }[];
      attachments: { name: string; mimeType: string }[];
    }[];
    attachments?: { name: string; mimeType: string }[];
    parent?: { id: number; title: string; type: string } | null;
    related?: { id: number; title: string; type: string }[];
    truncated?: boolean;
    nodeCount?: number;
  };
}

export interface TicketTypeResult { type: TicketType; confidence: number; evidence: string[]; }
export interface Complexity { level: ComplexityLevel; confidence: number; factors: string[]; }
export interface Stakeholder { name: string; confidence: number; evidence: string[]; }
export interface Dependency { name: string; inferred: boolean; confidence: number; evidence: string[]; }
export interface Risk { category: RiskCategory; severity: Severity; confidence: number; description: string; evidence: string[]; }
export interface MissingInfoItem { field: string; severity: Severity; confidence: number; reason: string; recommendation: string; }
export interface QualityScore { score: number; deductions: string[]; }

export interface AnalysisResult {
  objective: string;
  ticketType: TicketTypeResult;
  complexity: Complexity;
  businessContext: string;
  technicalContext: string;
  stakeholders: Stakeholder[];
  dependencies: Dependency[];
  risks: Risk[];
  missingInformation: MissingInfoItem[];
  qualityScore: QualityScore;
  openQuestions: string[];
  constraints: string[];
}

export interface ContextPackage extends AnalysisResult {
  recommendations: string[];
  overallRisk: Severity;
  blockingIssues: string[];
  executiveSummary: string;
  engineerSummary: string;
}

export interface TicketSignals {
  fullText: string;
  tokens: Set<string>;
}

export interface AnalysisContext {
  ticket: NormalizedTicket;
  signals: TicketSignals;
  partial: Partial<AnalysisResult>;
}

export interface Analyzer {
  name: string;
  version: string;
  analyze(ctx: AnalysisContext): Partial<AnalysisResult>;
}
