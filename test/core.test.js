import test from "node:test";
import assert from "node:assert/strict";
import { renderSvg, detectLanguage, clipLines, parseLineRanges } from "../src/core.js";

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

test("clips to maxLines, ignoring the final newline", async () => {
  assert.deepEqual(clipLines("a\r\nb\r\nc\n", 2), { code: "a\nb\n", lines: 3, clipped: true });
  // A blank last line is still rendered after clipping.
  assert.equal(codeLines(await renderSvg(clipLines("a\n\nb", 2).code, { fileName: "a.txt" })).length, 2);
  assert.deepEqual(clipLines("a\nb\n", 2), { code: "a\nb\n", lines: 2, clipped: false });
  assert.deepEqual(clipLines("a\nb\nc", 0), { code: "a\nb\nc", lines: 3, clipped: false });
});

test("line numbers are right-aligned in a gutter before the code", async () => {
  const code = Array.from({ length: 10 }, (_, i) => `x${i}`).join("\n");
  const lines = codeLines(await renderSvg(code, { fileName: "a.txt", lineNumbers: true }));
  const col = (x) => +((x - lines[9][0][0]) / 14.4).toFixed(3);
  assert.deepEqual(lines[0].map(([x, g]) => [col(x), g]), [[1, "1"], [4, "x"], [5, "0"]]);
  assert.deepEqual(lines[9].map(([x, g]) => [col(x), g]), [[0, "1"], [1, "0"], [4, "x"], [5, "9"]]);
});

test("parses line ranges and highlights only lines that exist", async () => {
  assert.deepEqual(parseLineRanges("3, 5-7,1"), [3, 5, 6, 7, 1]);
  for (const bad of ["", "0", "4-2", "a", "1,,2", "1-", "1-2000000"]) {
    assert.throws(() => parseLineRanges(bad), /Invalid line range/, bad);
  }
  const svg = await renderSvg("a\nb\nc", { fileName: "a.txt", highlight: [2, 9] });
  const rows = [...svg.matchAll(/<rect [^>]*fill="#44475A"/g)];
  assert.equal(rows.length, 1);
  assert.match(rows[0][0], /y="168"/); // codeY 134 + one 34 px row
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
