import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export const TICKET_ANALYZER_ENV_FILE = "TICKET_ANALYZER_ENV_FILE";

export const PROVIDER_ENV_VARS = Object.freeze({
  trello: ["TRELLO_API_KEY", "TRELLO_TOKEN"],
  jira: ["JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  azure: ["AZURE_DEVOPS_ORG", "AZURE_DEVOPS_PROJECT", "AZURE_DEVOPS_PAT"],
} as const);

export type ProviderName = keyof typeof PROVIDER_ENV_VARS;

export interface LoadedEnvironment {
  path: string;
  exists: boolean;
  values: Record<string, string>;
}

export interface ProviderConfigStatus {
  configured: boolean;
  missing: string[];
}

export function resolveEnvFile(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): string {
  const configuredPath = env[TICKET_ANALYZER_ENV_FILE]?.trim();
  if (!configuredPath) return path.resolve(cwd, ".env");
  return path.resolve(cwd, configuredPath);
}

export function readEnvFile(filePath: string): { exists: boolean; values: Record<string, string> } {
  if (!existsSync(filePath)) return { exists: false, values: {} };
  return { exists: true, values: dotenv.parse(readFileSync(filePath)) };
}

/**
 * Load the project env file while preserving every explicitly supplied environment variable.
 * dotenv parsing is used for quoting, comments, and multiline values; assignment is intentionally
 * limited to keys that are absent from the real environment.
 */
export function loadTicketEnvironment(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): LoadedEnvironment {
  const target = options.env ?? process.env;
  const filePath = resolveEnvFile(options.cwd, target);
  const file = readEnvFile(filePath);

  for (const [name, value] of Object.entries(file.values)) {
    if (target[name] === undefined) target[name] = value;
  }

  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(file.values)) values[name] = value;
  for (const [name, value] of Object.entries(target)) {
    if (typeof value === "string") values[name] = value;
  }

  return { path: filePath, exists: file.exists, values };
}

export function getProviderConfigStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  provider: ProviderName,
): ProviderConfigStatus {
  const missing = PROVIDER_ENV_VARS[provider].filter((name) => !env[name]?.trim());
  return { configured: missing.length === 0, missing: [...missing] };
}

export function getAllProviderConfigStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Record<ProviderName, ProviderConfigStatus> {
  return {
    trello: getProviderConfigStatus(env, "trello"),
    jira: getProviderConfigStatus(env, "jira"),
    azure: getProviderConfigStatus(env, "azure"),
  };
}

// Load credentials before the MCP server module initializes its request handlers.
loadTicketEnvironment();
