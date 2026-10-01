import test from "node:test";
import assert from "node:assert/strict";
import { renderSvg, detectLanguage } from "../src/core.js";

const codeLines = (svg) =>
  [...svg.matchAll(/<text [^>]*>((?:<tspan[^>]*>[^<]*<\/tspan>)*)<\/text>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ""),
  );

test("keeps whitespace and drops the trailing newline", async () => {
  const svg = await renderSvg('import fs  from "x";\n  indented\n', { fileName: "a.js" });
  assert.match(svg, /xml:space="preserve"/);
  assert.deepEqual(codeLines(svg), ['import fs  from &quot;x&quot;;', "  indented"]);
});

test("uses no SVG filter", async () => {
  const svg = await renderSvg("x", { fileName: "a.txt", theme: "light" });
  assert.doesNotMatch(svg, /<filter/);
});

test("escapes XML and strips invalid control characters", async () => {
  const svg = await renderSvg("a < b && c\x07", { fileName: "a.txt", footer: "<me>" });
  assert.deepEqual(codeLines(svg), ["a &lt; b &amp;&amp; c"]);
  assert.match(svg, /&lt;me&gt;/);
});

test("detects languages by alias, override and file name", () => {
  assert.equal(detectLanguage("src/a.ts"), "ts");
  assert.equal(detectLanguage("C:\\x\\b.hpp"), "cpp");
  assert.equal(detectLanguage("Dockerfile"), "dockerfile");
  assert.equal(detectLanguage("CMakeLists.txt"), "cmake");
  assert.equal(detectLanguage("notes.unknownext"), "text");
});
