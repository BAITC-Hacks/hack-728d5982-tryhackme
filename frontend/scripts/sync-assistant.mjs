// One owner for the proven chat: index.html. Build a DOM island for Next.js.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(path.join(frontend, "../index.html"), "utf8");
function extract(pattern, label) {
  const value = html.match(pattern)?.[1];
  if (!value) throw new Error(`index.html: missing ${label}; update the assistant bridge`);
  return value;
}
const styles = postcss.parse(extract(/<style>([\s\S]*?)<\/style>/, "styles"));
styles.walkRules((rule) => {
  if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map((selector) =>
    /^(?:html|body|:root)$/.test(selector) ? ".assistant-widget" : `.assistant-widget ${selector}`,
  );
});
const theme = await readFile(
  path.join(frontend, "src/components/assistant/widget-theme.css"),
  "utf8",
);
const icons = extract(/<body>\s*(<svg[\s\S]*?<\/svg>)/, "icons");
const widget = extract(/(<button\s+id="launcher"[\s\S]*?)<noscript/, "chat surface");
const seed = extract(/<script id="seedData" type="application\/json">([\s\S]*?)<\/script>/, "seed");
JSON.parse(seed);
const runtime = extract(/<script>([\s\S]*?)<\/script>/, "chat runtime");
await mkdir(path.join(frontend, "public/assistant"), { recursive: true });
await mkdir(path.join(frontend, "src/generated"), { recursive: true });
await writeFile(
  path.join(frontend, "src/generated/assistant.json"),
  JSON.stringify({
    markup: `${icons}${widget.replace('id="launcher"', 'id="launcher" disabled').replace('placeholder="Артикул, товар или ваш вопрос…"', 'placeholder="Что нужно найти?"')}<script id="seedData" type="application/json">${seed}</script>`,
  }),
);
await writeFile(path.join(frontend, "src/generated/widget.css"), `${styles}\n${theme}`);
await writeFile(
  path.join(frontend, "public/assistant/runtime.js"),
  `
if (!window.__ektAssistantMounted) {
  ${runtime}
  window.__ektAssistantMounted = true;
  document.getElementById("launcher").disabled = false;
  document.documentElement.dataset.assistantReady = "true";
  window.dispatchEvent(new Event("ekt:ready"));
}
`,
);
console.log("Assistant markup, scoped styles and runtime synced from index.html");
