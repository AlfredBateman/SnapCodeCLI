import test from "node:test";
import assert from "node:assert/strict";
import { renderSvg, detectLanguage } from "../src/core.js";

// Each code line as [x, glyph] pairs.
const codeLines = (svg) =>
  [...svg.matchAll(/<text y="[^"]*">((?:<tspan[^>]*>[^<]*<\/tspan>)*)<\/text>/g)].map((m) =>
    [...m[1].matchAll(/<tspan x="([^"]+)"[^>]*>([^<]*)<\/tspan>/g)].map(([, x, g]) => [Number(x), g]),
  );
const codeText = (svg) => codeLines(svg).map((line) => line.map(([, g]) => g).join(""));

test("keeps whitespace and drops the trailing newline", async () => {
  const svg = await renderSvg('import fs  from "x";\n  indented\n', { fileName: "a.js" });
  const [first, second] = codeLines(svg);
  const col = (x) => +((x - first[0][0]) / 14.4).toFixed(3);
  assert.equal(col(first.findLast(([, g]) => g === "f")[0]), 11); // "from" after the double space
  assert.equal(col(second[0][0]), 2);
});

test("aligns columns across tabs, CJK, fullwidth and emoji", async () => {
  const code = ["0123456789|", "\ttab\t  |", "  中文字  |", "ＡＢＣＤ  |", "😀 emoji  |", "👍🏽 skin   |", "👨‍👩‍👧 zwj    |", 'x = "é";  |'];
  const svg = await renderSvg(code.join("\n"), { fileName: "a.txt" });
  const bars = codeLines(svg).map((line) => line.find(([, g]) => g === "|")[0]);
  assert.equal(new Set(bars).size, 1, `bars at ${bars}`);

  // Canvas fits the widest line in display columns, not UTF-16 units: 100 CJK = 200 cells.
  const wide = await renderSvg("中".repeat(100), { fileName: "a.txt" });
  assert.equal(Number(wide.match(/<svg width="(\d+)"/)[1]), Math.ceil(200 * 14.4) + 180);
});

test("tabs advance to the next tab stop, 4 columns by default", async () => {
  const tabCol = async (opts) => {
    const [line] = codeLines(await renderSvg("a\tb\n", { fileName: "a.txt", ...opts }));
    return +((line[1][0] - line[0][0]) / 14.4).toFixed(3);
  };
  assert.equal(await tabCol({}), 4);
  assert.equal(await tabCol({ tabWidth: 2 }), 2);
  assert.equal(await tabCol({ tabWidth: 8 }), 8);
});

test("uses no SVG filter", async () => {
  const svg = await renderSvg("x", { fileName: "a.txt", theme: "light" });
  assert.doesNotMatch(svg, /<filter/);
});

test("escapes XML and strips invalid control characters", async () => {
  const svg = await renderSvg("a < b && c\x07", { fileName: "a.txt", footer: "<me>" });
  assert.deepEqual(codeText(svg), ["a&lt;b&amp;&amp;c"]);
  assert.match(svg, /&lt;me&gt;/);
});

test("detects languages by alias, override and file name", () => {
  assert.equal(detectLanguage("src/a.ts"), "ts");
  assert.equal(detectLanguage("C:\\x\\b.hpp"), "cpp");
  assert.equal(detectLanguage("Dockerfile"), "dockerfile");
  assert.equal(detectLanguage("CMakeLists.txt"), "cmake");
  assert.equal(detectLanguage("notes.unknownext"), "text");
});
