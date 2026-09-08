import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getProviderConfigStatus,
  loadTicketEnvironment,
  resolveEnvFile,
} from "./env.js";

describe("ticket analyzer environment loading", () => {
  test("resolves TICKET_ANALYZER_ENV_FILE relative to cwd and otherwise uses .env", () => {
    expect(resolveEnvFile("/project", {})).toBe(path.join("/project", ".env"));
    expect(resolveEnvFile("/project", { TICKET_ANALYZER_ENV_FILE: "config/local.env" })).toBe(
      path.join("/project", "config/local.env"),
    );
    expect(resolveEnvFile("/project", { TICKET_ANALYZER_ENV_FILE: "/tmp/ticket.env" })).toBe(
      "/tmp/ticket.env",
    );
  });

  test("loads file values without overwriting real environment values", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-env-"));
    const envFile = path.join(cwd, ".env");
    await writeFile(envFile, "JIRA_HOST=file.example.com\nJIRA_API_TOKEN=file-token\nUNRELATED=file-value\n");
    const env: NodeJS.ProcessEnv = {
      JIRA_HOST: "real.example.com",
      TICKET_ANALYZER_ENV_FILE: ".env",
    };

    const result = loadTicketEnvironment({ cwd, env });

    expect(result.values.JIRA_HOST).toBe("real.example.com");
    expect(result.values.JIRA_API_TOKEN).toBe("file-token");
    expect(result.values.UNRELATED).toBe("file-value");
    expect(env.JIRA_HOST).toBe("real.example.com");
    expect(env.JIRA_API_TOKEN).toBe("file-token");
  });
});

describe("local provider configuration", () => {
  test("reports missing fields without making a network request", () => {
    expect(getProviderConfigStatus({ JIRA_HOST: "example.com" }, "jira")).toEqual({
      configured: false,
      missing: ["JIRA_EMAIL", "JIRA_API_TOKEN"],
    });
  });
});
