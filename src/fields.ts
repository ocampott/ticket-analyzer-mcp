export interface JiraCustomFields {
  sprintField: string | null;
  epicField: string | null;
}

let cachedFields: JiraCustomFields | null = null;

export function resetFieldCache(): void {
  cachedFields = null;
}

export async function getJiraCustomFields(): Promise<JiraCustomFields> {
  if (cachedFields) return cachedFields;

  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!host || !email || !token) {
    console.error("[pm-mcp] Jira credentials not set — skipping field auto-detection");
    cachedFields = { sprintField: null, epicField: null };
    return cachedFields;
  }

  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;

  try {
    const response = await fetch(`https://${cleanHost}/rest/api/3/field`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });

    if (!response.ok) {
      console.error(`[pm-mcp] Field detection failed: HTTP ${response.status}`);
      cachedFields = { sprintField: null, epicField: null };
      return cachedFields;
    }

    const fields = (await response.json()) as { id: string; name: string }[];
    const lower = (s: string) => s.toLowerCase();

    const sprintField =
      fields.find((f) => lower(f.name) === "sprint")?.id ?? null;
    const epicField =
      fields.find(
        (f) => lower(f.name) === "epic link" || lower(f.name) === "epic name"
      )?.id ?? null;

    if (sprintField) console.error(`[pm-mcp] Sprint field detected: ${sprintField}`);
    if (epicField) console.error(`[pm-mcp] Epic field detected: ${epicField}`);

    cachedFields = { sprintField, epicField };
    return cachedFields;
  } catch (err) {
    console.error("[pm-mcp] Field detection error:", err);
    cachedFields = { sprintField: null, epicField: null };
    return cachedFields;
  }
}
