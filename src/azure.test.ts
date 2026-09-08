import { jest } from "@jest/globals";

// Mock fetch globally before importing the azure module
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as typeof fetch;

import {
  htmlToText,
  mimeFromName,
  isImageAttachment,
  isTextAttachment,
  extractBodyImages,
  getAzureWorkItem,
  searchAzureWorkItems,
  addAzureComment,
  getAzureStatus,
} from "./azure.js";

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "Error",
    json: async () => body,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

// ─── Part A: htmlToText ──────────────────────────────────────────────────────

describe("htmlToText", () => {
  it("returns empty string for null and undefined", () => {
    expect(htmlToText(null)).toBe("");
    expect(htmlToText(undefined)).toBe("");
    expect(htmlToText("")).toBe("");
  });

  it("strips plain tags", () => {
    expect(htmlToText("<div><span>hola</span></div>")).toBe("hola");
  });

  it("turns <br> into a newline", () => {
    expect(htmlToText("uno<br>dos")).toBe("uno\ndos");
    expect(htmlToText("uno<br />dos")).toBe("uno\ndos");
  });

  it("breaks lines on closing block tags", () => {
    expect(htmlToText("<div>uno</div><div>dos</div>")).toBe("uno\ndos");
    expect(htmlToText("<p>uno</p><p>dos</p>")).toBe("uno\ndos");
  });

  it("renders list items as dashes", () => {
    expect(htmlToText("<ul><li>uno</li><li>dos</li></ul>")).toBe("- uno\n- dos");
  });

  it("keeps link text with its href", () => {
    expect(htmlToText('<a href="https://x.com">ver</a>')).toBe("ver (https://x.com)");
  });

  it("drops the href for anchor-only mentions", () => {
    const mention = '<a href="#" data-vss-mention="version:2.0,abc">@Soledad Coronel</a>';
    expect(htmlToText(mention)).toBe("@Soledad Coronel");
  });

  it("replaces inline images with a marker instead of a signed URL", () => {
    const html = '<div>antes<img src="https://dev.azure.com/org/_apis/wit/attachments/guid">despues</div>';
    expect(htmlToText(html)).toBe("antes[imagen adjunta]despues");
  });

  it("decodes named entities", () => {
    expect(htmlToText("a&nbsp;b &amp; c")).toBe("a b & c");
    expect(htmlToText("Espa&ntilde;ol asignaci&oacute;n")).toBe("Español asignación");
  });

  it("decodes numeric entities in decimal and hex", () => {
    expect(htmlToText("&#233;xito &#x41;")).toBe("éxito A");
  });

  it("leaves unknown entities untouched", () => {
    expect(htmlToText("&fakeentity; ok")).toBe("&fakeentity; ok");
  });

  it("removes style and script blocks entirely", () => {
    expect(htmlToText("<style>.a{color:red}</style><div>texto</div>")).toBe("texto");
    expect(htmlToText("<script>alert(1)</script><div>texto</div>")).toBe("texto");
  });

  it("collapses runs of blank lines to at most one", () => {
    expect(htmlToText("<p>uno</p><br><br><br><p>dos</p>")).toBe("uno\n\ndos");
  });

  it("separates table cells with pipes", () => {
    expect(htmlToText("<table><tr><td>a</td><td>b</td></tr></table>")).toBe("a | b |");
  });

  it("keeps a row on one line even when Azure nests divs inside each cell", () => {
    const row = "<table><tr><td><div>1</div></td><td><div>Traductor</div></td></tr></table>";
    expect(htmlToText(row)).toBe("1 | Traductor |");
  });

  it("handles the real shape Azure returns for a description", () => {
    const html =
      '<div><span>Se requiere que el sistema importe las asignaciones&nbsp;</span></div>' +
      "<div><br></div><div>obtenidas del archivo CSV.</div>";
    expect(htmlToText(html)).toBe("Se requiere que el sistema importe las asignaciones\n\nobtenidas del archivo CSV.");
  });
});

// ─── Part A2: inline base64 images ───────────────────────────────────────────

describe("extractBodyImages", () => {
  const PNG = "iVBORw0KGgoAAAANSUhEUg==";
  const GUID = "c96a0e59-40a4-4e86-956f-05baf5d86e3b";
  const ATT = `https://dev.azure.com/Org/8d85c777-58a3-43a5-9d28-1399100e9534/_apis/wit/attachments/${GUID}`;

  it("returns the html untouched when there is no image", () => {
    const { html, inline, referenced } = extractBodyImages("<div>hola</div>", "wi1-desc");
    expect(html).toBe("<div>hola</div>");
    expect(inline).toEqual([]);
    expect(referenced).toEqual([]);
  });

  it("lifts a data-uri image out and leaves a named marker", () => {
    const input = `<div>antes<img alt=imagen src="data:image/png;base64,${PNG}">despues</div>`;
    const { html, inline } = extractBodyImages(input, "wi1-desc");

    expect(inline).toEqual([{ name: "wi1-desc-1.png", mimeType: "image/png", base64: PNG }]);
    expect(html).toBe("<div>antes[imagen embebida: wi1-desc-1.png]despues</div>");
    expect(htmlToText(html)).toBe("antes[imagen embebida: wi1-desc-1.png]despues");
  });

  it("numbers several images and maps the mime type to an extension", () => {
    const input = `<img src="data:image/jpeg;base64,${PNG}"><img src="data:image/gif;base64,${PNG}">`;
    const { inline } = extractBodyImages(input, "wi9-com1");
    expect(inline.map((i) => i.name)).toEqual(["wi9-com1-1.jpg", "wi9-com1-2.gif"]);
  });

  it("captures an attachment URL that is not an AttachedFile relation", () => {
    const { html, referenced } = extractBodyImages(`<img src="${ATT}?fileName=image.png" alt=Image>`, "wi1596-com2");

    expect(referenced).toEqual([{ name: "wi1596-com2-1.png", url: `${ATT}?fileName=image.png` }]);
    expect(htmlToText(html)).toBe("[imagen: wi1596-com2-1.png]");
  });

  it("takes the extension from the fileName query param", () => {
    const { referenced } = extractBodyImages(`<img src="${ATT}?fileName=Image%20%281%29.jpg">`, "wi1-com1");
    expect(referenced[0].name).toBe("wi1-com1-1.jpg");
  });

  it("defaults to png when the URL carries no fileName", () => {
    const { referenced } = extractBodyImages(`<img src="${ATT}">`, "wi1-com1");
    expect(referenced[0].name).toBe("wi1-com1-1.png");
  });

  it("numbers inline and referenced images in one shared sequence", () => {
    const input = `<img src="data:image/png;base64,${PNG}"><img src="${ATT}?fileName=a.png">`;
    const { inline, referenced } = extractBodyImages(input, "wi1-desc");
    expect(inline[0].name).toBe("wi1-desc-1.png");
    expect(referenced[0].name).toBe("wi1-desc-2.png");
  });

  it("leaves a non-attachment <img> alone for htmlToText to mark", () => {
    const input = '<img src="https://example.com/logo.png">';
    const { html, inline, referenced } = extractBodyImages(input, "wi1-desc");
    expect(inline).toEqual([]);
    expect(referenced).toEqual([]);
    expect(htmlToText(html)).toBe("[imagen adjunta]");
  });

  it("skips an inline image over 5MB instead of returning it", () => {
    const huge = "A".repeat(8 * 1024 * 1024);
    const { html, inline } = extractBodyImages(`<img src="data:image/png;base64,${huge}">`, "wi1-desc");
    expect(inline).toEqual([]);
    expect(html).toBe("[imagen embebida omitida: supera 5MB]");
  });

  it("tolerates whitespace inside the base64 payload", () => {
    const { inline } = extractBodyImages(
      '<img src="data:image/png;base64,iVBO Rw0K\nGgo=">',
      "wi1-desc"
    );
    expect(inline[0].base64).toBe("iVBORw0KGgo=");
  });
});

// ─── Part B: attachment type detection ───────────────────────────────────────

describe("attachment helpers", () => {
  it("infers image mime types from the file name", () => {
    expect(mimeFromName("mmq .png")).toBe("image/png");
    expect(mimeFromName("foto.JPG")).toBe("image/jpeg");
  });

  it("falls back to octet-stream for unknown extensions", () => {
    expect(mimeFromName("DMZ_3.zip")).toBe("application/octet-stream");
    expect(mimeFromName("sinextension")).toBe("application/octet-stream");
  });

  it("detects images by extension", () => {
    expect(isImageAttachment("usuario mmq.png")).toBe(true);
    expect(isImageAttachment("job_categories.xlsx")).toBe(false);
  });

  it("detects text attachments by extension and mime", () => {
    expect(isTextAttachment("Assigned-NCT.csv", "text/csv")).toBe(true);
    expect(isTextAttachment("query.sql", "application/octet-stream")).toBe(true);
    expect(isTextAttachment("DMZ_3.zip", "application/octet-stream")).toBe(false);
  });
});

// ─── Part C: getAzureWorkItem ────────────────────────────────────────────────

const WORK_ITEM_RAW = {
  id: 1596,
  fields: {
    "System.Title": "[CMMC] Asignaciones desde memoq",
    "System.WorkItemType": "User Story",
    "System.State": "Active",
    "System.Reason": "Reintroduced in Scope",
    "System.AssignedTo": { displayName: "Tomas Ocampo" },
    "System.CreatedBy": { displayName: "Mariela Silvano" },
    "System.Tags": "CMMC; QA Int",
    "System.IterationPath": "TerraSoft\\124",
    "System.AreaPath": "TerraSoft",
    "System.Description": "<div>Importar asignaciones.</div>",
    "Microsoft.VSTS.Common.AcceptanceCriteria": "<div>Se crea el proyecto.</div>",
    "Microsoft.VSTS.Common.Priority": 2,
    "Microsoft.VSTS.Scheduling.StoryPoints": 5,
    "System.Parent": 1589,
  },
  relations: [
    { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://dev.azure.com/o/_apis/wit/workItems/1660" },
    { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/o/_apis/wit/workItems/1589" },
    { rel: "System.LinkTypes.Related", url: "https://dev.azure.com/o/_apis/wit/workItems/1594" },
    {
      rel: "AttachedFile",
      url: "https://dev.azure.com/o/_apis/wit/attachments/guid-1",
      attributes: { name: "mmq.png" },
    },
    {
      rel: "AttachedFile",
      url: "https://dev.azure.com/o/_apis/wit/attachments/guid-2",
      attributes: { name: "DMZ_3.zip" },
    },
  ],
  _links: { html: { href: "https://dev.azure.com/o/p/_workitems/edit/1596" } },
};

const LINKED_BATCH = {
  value: [
    {
      id: 1660,
      fields: {
        "System.Title": "Backend del importador",
        "System.WorkItemType": "Task",
        "System.State": "Doing",
        "System.AssignedTo": { displayName: "Tomas Ocampo" },
        "Microsoft.VSTS.Scheduling.RemainingWork": 4,
        "System.Description": "<div>Detalle real de la task.</div>",
        "Microsoft.VSTS.Common.AcceptanceCriteria": "<div>La task tiene su propio criterio.</div>",
        "Microsoft.VSTS.TCM.ReproSteps": "<div>1. Abrir. 2. Explota.</div>",
      },
    },
    { id: 1589, fields: { "System.Title": "Epic CMMC", "System.WorkItemType": "Feature" } },
    { id: 1594, fields: { "System.Title": "Story vecina", "System.WorkItemType": "User Story" } },
  ],
};

/** Root -> 2 -> 3 -> 4, one child per level, for depth and cap tests. */
function chainNode(id: number, childId?: number) {
  return {
    id,
    fields: { "System.Title": `nodo ${id}`, "System.WorkItemType": "Task", "System.State": "New" },
    relations: childId
      ? [{ rel: "System.LinkTypes.Hierarchy-Forward", url: `https://dev.azure.com/o/_apis/wit/workItems/${childId}` }]
      : [],
  };
}

function wireChain(mock: typeof mockFetch) {
  mock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/comments")) return makeResponse(200, { comments: [], totalCount: 0, count: 0 });
    if (url.includes("/workitems/1?")) return makeResponse(200, chainNode(1, 2));
    const ids = /ids=([\d,]+)/.exec(url)?.[1];
    if (ids) {
      const map: Record<string, unknown> = { "2": chainNode(2, 3), "3": chainNode(3, 4), "4": chainNode(4) };
      return makeResponse(200, { value: ids.split(",").map((i) => map[i]).filter(Boolean) });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const COMMENTS_PAGE = {
  totalCount: 2,
  count: 2,
  comments: [
    { text: "<div>Segundo</div>", createdBy: { displayName: "Soledad Coronel" }, createdDate: "2026-08-31T12:00:00Z" },
    { text: "<div>Primero</div>", createdBy: { displayName: "Mariela Silvano" }, createdDate: "2026-08-30T12:00:00Z" },
  ],
};

describe("getAzureWorkItem", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.AZURE_DEVOPS_ORG = "TerraTranslations";
    process.env.AZURE_DEVOPS_PROJECT = "TerraSoft";
    process.env.AZURE_DEVOPS_PAT = "fake-pat";
  });

  function wireHappyPath() {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/workitems/1596")) return makeResponse(200, WORK_ITEM_RAW);
      if (url.includes("/workitems?ids=")) return makeResponse(200, LINKED_BATCH);
      if (url.includes("/comments")) return makeResponse(200, COMMENTS_PAGE);
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it("throws a setup hint when credentials are missing", async () => {
    delete process.env.AZURE_DEVOPS_PAT;
    await expect(getAzureWorkItem(1596)).rejects.toThrow(/ticket-analyzer:setup/);
  });

  it("authenticates with an empty username and the PAT", async () => {
    wireHappyPath();
    await getAzureWorkItem(1596, false);

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    const expected = `Basic ${Buffer.from(":fake-pat").toString("base64")}`;
    expect(headers.Authorization).toBe(expected);
  });

  it("maps the core fields", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);

    expect(workItem.id).toBe(1596);
    expect(workItem.title).toBe("[CMMC] Asignaciones desde memoq");
    expect(workItem.workItemType).toBe("User Story");
    expect(workItem.state).toBe("Active");
    expect(workItem.reason).toBe("Reintroduced in Scope");
    expect(workItem.priority).toBe(2);
    expect(workItem.storyPoints).toBe(5);
    expect(workItem.assignee).toBe("Tomas Ocampo");
    expect(workItem.createdBy).toBe("Mariela Silvano");
    expect(workItem.iterationPath).toBe("TerraSoft\\124");
    expect(workItem.url).toBe("https://dev.azure.com/o/p/_workitems/edit/1596");
  });

  it("converts description and acceptance criteria from HTML", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);

    expect(workItem.description).toBe("Importar asignaciones.");
    expect(workItem.acceptanceCriteria).toBe("Se crea el proyecto.");
  });

  it("splits semicolon-separated tags", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);
    expect(workItem.tags).toEqual(["CMMC", "QA Int"]);
  });

  it("resolves children as full nodes, and parent/related as summaries", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);

    expect(workItem.children).toHaveLength(1);
    expect(workItem.children[0]).toMatchObject({
      id: 1660,
      workItemType: "Task",
      title: "Backend del importador",
      state: "Doing",
      assignee: "Tomas Ocampo",
      remainingWork: 4,
    });

    expect(workItem.parent).toEqual({ id: 1589, title: "Epic CMMC", type: "Feature" });
    expect(workItem.related).toEqual([{ id: 1594, title: "Story vecina", type: "User Story" }]);
  });

  it("brings the child's own description, criteria, repro steps and comments", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);
    const child = workItem.children[0];

    expect(child.description).toBe("Detalle real de la task.");
    expect(child.acceptanceCriteria).toBe("La task tiene su propio criterio.");
    expect(child.reproSteps).toBe("1. Abrir. 2. Explota.");
    expect(child.comments.map((c) => c.text)).toEqual(["Primero", "Segundo"]);
  });

  it("returns comments oldest-first with HTML stripped", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);

    expect(workItem.comments.map((c) => c.text)).toEqual(["Primero", "Segundo"]);
    expect(workItem.comments[0].author).toBe("Mariela Silvano");
  });

  it("keeps non-image attachments in the list and skips images when disabled", async () => {
    wireHappyPath();
    const { workItem, images } = await getAzureWorkItem(1596, false);

    expect(images).toEqual([]);
    expect(workItem.attachments).toEqual([
      { name: "DMZ_3.zip", mimeType: "application/octet-stream", url: "https://dev.azure.com/o/_apis/wit/attachments/guid-2" },
    ]);
  });

  it("shows an unreadable child as a stub instead of dropping it", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/workitems/1596")) return makeResponse(200, WORK_ITEM_RAW);
      if (url.includes("/workitems?ids=")) return makeResponse(200, { value: [] });
      if (url.includes("/comments")) return makeResponse(200, COMMENTS_PAGE);
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { workItem } = await getAzureWorkItem(1596, false);
    expect(workItem.children).toHaveLength(1);
    expect(workItem.children[0].id).toBe(1660);
    expect(workItem.children[0].title).toMatch(/inaccesible/);
    expect(workItem.parent?.title).toBe("(work item 1589 inaccesible)");
  });

  it("counts every node in the tree", async () => {
    wireHappyPath();
    const { workItem } = await getAzureWorkItem(1596, false);
    expect(workItem.nodeCount).toBe(2);
    expect(workItem.truncated).toBe(false);
  });

  it("descends the whole chain within max_depth", async () => {
    wireChain(mockFetch);
    const { workItem } = await getAzureWorkItem(1, false, undefined, false, 3, 40);

    expect(workItem.nodeCount).toBe(4);
    expect(workItem.truncated).toBe(false);
    expect(workItem.children[0].children[0].children[0].id).toBe(4);
  });

  it("stops at max_depth and flags the tree as truncated", async () => {
    wireChain(mockFetch);
    const { workItem } = await getAzureWorkItem(1, false, undefined, false, 1, 40);

    expect(workItem.nodeCount).toBe(2);
    expect(workItem.truncated).toBe(true);
    expect(workItem.children[0].children[0].title).toMatch(/truncado/);
  });

  it("max_depth 0 returns the root alone", async () => {
    wireChain(mockFetch);
    const { workItem } = await getAzureWorkItem(1, false, undefined, false, 0, 40);

    expect(workItem.nodeCount).toBe(1);
    expect(workItem.truncated).toBe(true);
    expect(workItem.children[0].title).toMatch(/truncado/);
  });

  it("stops at max_nodes even when depth allows more", async () => {
    wireChain(mockFetch);
    const { workItem } = await getAzureWorkItem(1, false, undefined, false, 10, 2);

    expect(workItem.nodeCount).toBe(2);
    expect(workItem.truncated).toBe(true);
  });

  it("does not loop forever on a hierarchy cycle", async () => {
    const selfLink = {
      id: 7,
      fields: { "System.Title": "ciclo", "System.WorkItemType": "Task", "System.State": "New" },
      relations: [
        { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://dev.azure.com/o/_apis/wit/workItems/7" },
      ],
    };
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/comments")) return makeResponse(200, { comments: [], totalCount: 0, count: 0 });
      if (url.includes("/workitems/7?")) return makeResponse(200, selfLink);
      return makeResponse(200, { value: [selfLink] });
    });

    const { workItem } = await getAzureWorkItem(7, false);
    expect(workItem.nodeCount).toBe(1);
    expect(workItem.children).toEqual([]);
  });

  it("fetches comments for every node in the tree, not just the root", async () => {
    wireHappyPath();
    await getAzureWorkItem(1596, false);

    const commentCalls = mockFetch.mock.calls.filter(([u]) => String(u).includes("/comments"));
    const ids = commentCalls.map(([u]) => /workItems\/(\d+)\/comments/.exec(String(u))?.[1]);
    expect(new Set(ids)).toEqual(new Set(["1596", "1660"]));
  });

  it("reports a missing work item plainly", async () => {
    mockFetch.mockResolvedValue(makeResponse(404, {}));
    await expect(getAzureWorkItem(999999)).rejects.toThrow("work item no encontrado");
  });

  it("treats the 203 sign-in page as a credential problem", async () => {
    mockFetch.mockResolvedValue(makeResponse(203, {}));
    await expect(getAzureWorkItem(1596)).rejects.toThrow(/credenciales de Azure DevOps/);
  });
});

// ─── Part D: searchAzureWorkItems ────────────────────────────────────────────

describe("searchAzureWorkItems", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.AZURE_DEVOPS_ORG = "TerraTranslations";
    process.env.AZURE_DEVOPS_PROJECT = "TerraSoft";
    process.env.AZURE_DEVOPS_PAT = "fake-pat";
  });

  it("wraps a bare WHERE clause into a full WIQL query", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/wiql")) return makeResponse(200, { workItems: [{ id: 1660 }] });
      return makeResponse(200, LINKED_BATCH);
    });

    await searchAzureWorkItems("[System.State] = 'Active'");

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body)) as { query: string };
    expect(body.query).toBe(
      "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active' ORDER BY [System.ChangedDate] DESC"
    );
  });

  it("passes a full SELECT through untouched", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/wiql")) return makeResponse(200, { workItems: [] });
      return makeResponse(200, { value: [] });
    });

    const query = "SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 1";
    await searchAzureWorkItems(query);

    const body = JSON.parse(String(mockFetch.mock.calls[0][1]?.body)) as { query: string };
    expect(body.query).toBe(query);
  });

  it("hydrates ids into titles and states", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/wiql")) return makeResponse(200, { workItems: [{ id: 1660 }] });
      return makeResponse(200, LINKED_BATCH);
    });

    const result = await searchAzureWorkItems("[System.State] = 'Active'");
    expect(result.total).toBe(1);
    expect(result.workItems[0]).toMatchObject({
      id: 1660,
      title: "Backend del importador",
      type: "Task",
      state: "Doing",
    });
  });

  it("returns an empty result set without a batch call", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { workItems: [] }));
    const result = await searchAzureWorkItems("[System.Id] = 0");
    expect(result).toEqual({ total: 0, workItems: [] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Part E: write path and status ───────────────────────────────────────────

describe("addAzureComment", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.AZURE_DEVOPS_ORG = "TerraTranslations";
    process.env.AZURE_DEVOPS_PROJECT = "TerraSoft";
    process.env.AZURE_DEVOPS_PAT = "fake-pat";
  });

  it("posts the comment text", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await addAzureComment(1596, "listo");

    const [, init] = mockFetch.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ text: "listo" });
  });

  it("explains that a read-only PAT cannot write", async () => {
    mockFetch.mockResolvedValue(makeResponse(403, {}));
    await expect(addAzureComment(1596, "listo")).rejects.toThrow(/Read & Write/);
  });
});

describe("getAzureStatus", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.AZURE_DEVOPS_ORG = "TerraTranslations";
    process.env.AZURE_DEVOPS_PROJECT = "TerraSoft";
    process.env.AZURE_DEVOPS_PAT = "fake-pat";
  });

  it("reports not configured when env vars are missing", async () => {
    delete process.env.AZURE_DEVOPS_PAT;
    await expect(getAzureStatus()).resolves.toEqual({ configured: false, connected: false });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("lists the work item types when connected", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { value: [{ name: "User Story" }, { name: "Task" }] }));
    const status = await getAzureStatus();
    expect(status.connected).toBe(true);
    expect(status.workItemTypes).toEqual(["User Story", "Task"]);
  });

  it("does not throw when the network is down", async () => {
    mockFetch.mockRejectedValue(new Error("ENOTFOUND"));
    const status = await getAzureStatus();
    expect(status).toMatchObject({ configured: true, connected: false, error: "ENOTFOUND" });
  });
});
