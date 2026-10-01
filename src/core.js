import { bundledLanguages, codeToTokens } from "shiki";

// Only names and extensions that are not already shiki language ids or aliases.
const FILENAME_LANG = {
  "cmakelists.txt": "cmake",
  gemfile: "ruby",
  rakefile: "ruby",
  jenkinsfile: "groovy",
  ".bashrc": "bash",
  ".zshrc": "bash",
};

const EXT_LANG = {
  h: "c",
  cc: "cpp",
  cxx: "cpp",
  hh: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  htm: "html",
  svg: "xml",
  pl: "perl",
  pm: "perl",
  ex: "elixir",
  exs: "elixir",
  ml: "ocaml",
  mk: "make",
  psm1: "powershell",
  gradle: "groovy",
};

export const THEME_PRESETS = {
  dark: {
    shikiTheme: "dracula",
    gradientStart: "#3E1A70",
    gradientEnd: "#184EAB",
    windowBg: "#1E1F29",
    titleText: "#C9D1D9",
  },
  light: {
    shikiTheme: "github-light",
    gradientStart: "#E8F1FF",
    gradientEnd: "#C9D9FF",
    windowBg: "#FFFFFF",
    titleText: "#57606A",
  },
};

const graphemes = new Intl.Segmenter();
// ponytail: approximates UAX #11 East Asian Wide/Fullwidth plus emoji presentation; swap for get-east-asian-width if a script misaligns.
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦\u{20000}-\u{3FFFD}]|\p{Emoji_Presentation}|️/u;

function escapeXml(value) {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // not allowed in XML 1.0
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function detectLanguage(fileName) {
  const base = fileName.split(/[\\/]/).pop().toLowerCase();
  const dot = base.lastIndexOf(".");
  const ext = dot === -1 ? base : base.slice(dot + 1);
  const lang = FILENAME_LANG[base] ?? EXT_LANG[ext] ?? ext;
  return lang in bundledLanguages ? lang : "text";
}

// Pure: code + options -> SVG string. No filesystem, no rasteriser.
export async function renderSvg(code, { fileName = "", theme = "dark", footer = null, tabWidth = 4 } = {}) {
  code = code.replace(/\r?\n$/, "");
  const themeKey = theme;
  const language = detectLanguage(fileName);
  const preset = THEME_PRESETS[themeKey];

  // Shorthand loads only this grammar and theme, on demand.
  const tokenResult = await codeToTokens(code, {
    lang: language,
    theme: preset.shikiTheme,
  });
  const lines = tokenResult.tokens || [];

  const fontSize = 24;
  const lineHeight = 34;
  const charWidth = fontSize * 0.6; // advance of JetBrains Mono, Menlo, DejaVu Sans Mono
  const innerPadding = 40;
  const outerPadding = 50;
  const titleBarHeight = 44;
  const footerHeight = 34;
  const minCodeWidth = 760;
  const cardX = outerPadding;
  const cardY = outerPadding;
  const codeX = cardX + innerPadding;
  const codeY = cardY + titleBarHeight + innerPadding;

  // Every grapheme is anchored to its own cell, so columns line up whatever font the
  // renderer picks (librsvg ignores embedded @font-face and x lists, so neither is used).
  const defaultColor = themeKey === "dark" ? "#F8F8F2" : "#24292F";
  let maxCols = 1;
  const linesSvg = lines
    .map((tokens, row) => {
      let col = 0;
      let spans = "";
      for (const token of tokens) {
        for (const { segment: g } of graphemes.segment(token.content)) {
          if (g === "\t") {
            col = (Math.floor(col / tabWidth) + 1) * tabWidth;
            continue;
          }
          if (g !== " ") {
            const x = +(codeX + col * charWidth).toFixed(2);
            spans += `<tspan x="${x}" fill="${token.color || defaultColor}">${escapeXml(g)}</tspan>`;
          }
          col += WIDE.test(g) ? 2 : 1;
        }
      }
      maxCols = Math.max(maxCols, col);
      return `<text y="${codeY + row * lineHeight + fontSize}">${spans}</text>`;
    })
    .join("\n");

  const codeWidth = Math.max(minCodeWidth, Math.ceil(maxCols * charWidth));
  const codeHeight = Math.max(lineHeight, lines.length * lineHeight);
  const cardWidth = codeWidth + innerPadding * 2;
  const footerText = footer;
  const footerSpace = footerText ? footerHeight : 0;
  const cardHeight = titleBarHeight + codeHeight + innerPadding * 2 + footerSpace;
  const imageWidth = cardWidth + outerPadding * 2;
  const imageHeight = cardHeight + outerPadding * 2;

  const footerSvg = footerText
    ? `<text x="${cardX + innerPadding}" y="${cardY + cardHeight - 10}" fill="${
        themeKey === "dark" ? "#FFFFFF" : "#24292F"
      }" opacity="0.5" font-size="16" font-family="JetBrains Mono, Menlo, Consolas, monospace">${escapeXml(
        footerText,
      )}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}" xmlns="http://www.w3.org/2000/svg" xml:space="preserve">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${preset.gradientStart}" />
      <stop offset="100%" stop-color="${preset.gradientEnd}" />
    </linearGradient>
  </defs>
  <rect width="${imageWidth}" height="${imageHeight}" fill="url(#bgGradient)" />
  ${[1, 2, 3, 4, 5, 6, 7, 8]
    .map((i) => `<rect x="${cardX - i}" y="${cardY + i}" width="${cardWidth + i * 2}" height="${cardHeight + i * 2}" rx="${10 + i}" fill="#000000" opacity="0.025" />`)
    .join("")}
  <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="10" ry="10" fill="${preset.windowBg}" />
  <circle cx="${cardX + 20}" cy="${cardY + 22}" r="6" fill="#FF5F56"/>
  <circle cx="${cardX + 40}" cy="${cardY + 22}" r="6" fill="#FFBD2E"/>
  <circle cx="${cardX + 60}" cy="${cardY + 22}" r="6" fill="#27C93F"/>
  <text x="${cardX + 84}" y="${cardY + 27}" fill="${preset.titleText}" font-size="16" font-family="JetBrains Mono, Menlo, Consolas, monospace">${escapeXml(
    fileName,
  )}</text>
  <g font-size="${fontSize}" font-family="JetBrains Mono, Menlo, Consolas, monospace">
${linesSvg}
  </g>
  ${footerSvg}
</svg>`;
}
