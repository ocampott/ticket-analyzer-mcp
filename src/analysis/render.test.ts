import { renderMarkdown } from "./render.js";
import { analyzeTicket } from "./index.js";
import { loginGoogle } from "./__fixtures__/tickets.js";

test("renderMarkdown includes headline sections", () => {
  const md = renderMarkdown(analyzeTicket(loginGoogle));
  expect(md).toContain("# Análisis");
  expect(md).toContain("## Resumen ejecutivo");
  expect(md).toMatch(/Tipo:|Complejidad:/);
});

test("renderMarkdown shows risks, dependencies and recommendations when present", () => {
  const md = renderMarkdown(analyzeTicket(loginGoogle));
  expect(md).toContain("## Dependencias");
  expect(md).toContain("## Riesgos");
  expect(md).toContain("## Recomendaciones");
});
