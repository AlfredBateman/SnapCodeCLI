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
export async function renderSvg(code, { fileName = "", theme = "dark", footer = null } = {}) {
  code = code.replace(/\t/g, "  ").replace(/\r?\n$/, "");
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
  const charWidth = 14;
  const innerPadding = 40;
  const outerPadding = 50;
  const titleBarHeight = 44;
  const footerHeight = 34;
  const minCodeWidth = 760;
  const maxChars = Math.max(
    ...code.split(/\r?\n/).map((line) => line.length),
    1,
  );

  const codeWidth = Math.max(minCodeWidth, Math.ceil(maxChars * charWidth));
  const codeHeight = Math.max(lineHeight, lines.length * lineHeight);
  const cardWidth = codeWidth + innerPadding * 2;
  const footerText = footer;
  const footerSpace = footerText ? footerHeight : 0;
  const cardHeight = titleBarHeight + codeHeight + innerPadding * 2 + footerSpace;
  const imageWidth = cardWidth + outerPadding * 2;
  const imageHeight = cardHeight + outerPadding * 2;
  const cardX = outerPadding;
  const cardY = outerPadding;
  const codeX = cardX + innerPadding;
  const codeY = cardY + titleBarHeight + innerPadding;

  // One <text> per line; tspans flow so token spacing comes from the font, not a guess.
  const defaultColor = themeKey === "dark" ? "#F8F8F2" : "#24292F";
  const linesSvg = lines
    .map((tokens, row) => {
      const spans = tokens
        .filter((token) => token.content)
        .map((token) => `<tspan fill="${token.color || defaultColor}">${escapeXml(token.content)}</tspan>`)
        .join("");
      return `<text x="${codeX}" y="${codeY + row * lineHeight + fontSize}">${spans}</text>`;
    })
    .join("\n");

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
