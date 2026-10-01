#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Command } from "commander";
import clipboard from "clipboardy";
import sharp from "sharp";
import { createHighlighter, bundledLanguages } from "shiki";

const program = new Command();

const EXT_TO_LANG = {
  ".js": "javascript",
  ".cjs": "javascript",
  ".mjs": "javascript",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".jsx": "jsx",
  ".py": "python",
  ".java": "java",
  ".rb": "ruby",
  ".php": "php",
  ".go": "go",
  ".rs": "rust",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".cs": "csharp",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".sh": "bash",
  ".zsh": "bash",
  ".json": "json",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".md": "markdown",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
  ".sql": "sql",
  ".xml": "xml",
  ".toml": "toml",
};

const THEME_PRESETS = {
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_LANG[ext] || "plaintext";
}

function getGitBlameFooter(filePath) {
  const absPath = path.resolve(filePath);
  const fileDir = path.dirname(absPath);

  try {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fileDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    const relPath = path.relative(repoRoot, absPath);
    const info = execFileSync(
      "git",
      ["log", "-1", "--format=%an|%ad", "--date=short", "--", relPath],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .trim()
      .split("|");

    if (info.length !== 2 || !info[0] || !info[1]) {
      return null;
    }

    return `Last edited by ${info[0]} on ${info[1]}`;
  } catch {
    return null;
  }
}

async function run() {
  program
    .name("snapcode")
    .description("Generate syntax-highlighted PNG snapshots from source code files.")
    .argument("<filepath>", "Path to the source code file")
    .option("-t, --theme <theme>", "Theme variant: dark or light", "dark")
    .option("-o, --output <file>", "Output PNG file name", "snapshot.png")
    .option(
      "--clipboard <mode>",
      "Clipboard mode: path or none (default: path)",
      "path",
    )
    .option(
      "--no-footer",
      "Disable optional git footer even when repository metadata is available",
    )
    .parse(process.argv);

  const filePath = program.args[0];
  const options = program.opts();

  if (!filePath) {
    program.help();
    return;
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const themeKey = options.theme.toLowerCase();
  if (!THEME_PRESETS[themeKey]) {
    console.error("Invalid theme. Use --theme dark or --theme light.");
    process.exit(1);
  }

  if (!String(options.output).toLowerCase().endsWith(".png")) {
    console.error("Output file must end with .png");
    process.exit(1);
  }

  const clipboardMode = String(options.clipboard).toLowerCase();
  if (!["path", "none"].includes(clipboardMode)) {
    console.error("Invalid clipboard mode. Use --clipboard path or --clipboard none.");
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, "utf8").replace(/\t/g, "  ");
  const language = detectLanguage(filePath);
  const preset = THEME_PRESETS[themeKey];
  const fileName = path.basename(filePath);

  const highlighter = await createHighlighter({
    themes: ["dracula", "github-light"],
    langs: Object.keys(bundledLanguages),
  });

  let tokenResult;
  try {
    tokenResult = highlighter.codeToTokens(code, {
      lang: language,
      theme: preset.shikiTheme,
    });
  } catch {
    tokenResult = highlighter.codeToTokens(code, {
      lang: "plaintext",
      theme: preset.shikiTheme,
    });
  }
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
  const footerText = options.footer ? getGitBlameFooter(filePath) : null;
  const footerSpace = footerText ? footerHeight : 0;
  const cardHeight = titleBarHeight + codeHeight + innerPadding * 2 + footerSpace;
  const imageWidth = cardWidth + outerPadding * 2;
  const imageHeight = cardHeight + outerPadding * 2;
  const cardX = outerPadding;
  const cardY = outerPadding;
  const codeX = cardX + innerPadding;
  const codeY = cardY + titleBarHeight + innerPadding;

  let linesSvg = "";
  for (let row = 0; row < lines.length; row += 1) {
    const y = codeY + row * lineHeight + fontSize;
    let x = codeX;

    for (const token of lines[row]) {
      if (!token.content) {
        continue;
      }

      const safeText = escapeXml(token.content);
      const tokenWidth = token.content.length * charWidth;
      const color = token.color || (themeKey === "dark" ? "#F8F8F2" : "#24292F");

      linesSvg += `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" font-family="JetBrains Mono, Menlo, Consolas, monospace">${safeText}</text>`;
      x += tokenWidth;
    }
  }

  const footerSvg = footerText
    ? `<text x="${cardX + innerPadding}" y="${cardY + cardHeight - 10}" fill="${
        themeKey === "dark" ? "#FFFFFF" : "#24292F"
      }" opacity="0.5" font-size="16" font-family="JetBrains Mono, Menlo, Consolas, monospace">${escapeXml(
        footerText,
      )}</text>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${preset.gradientStart}" />
      <stop offset="100%" stop-color="${preset.gradientEnd}" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.22" />
    </filter>
  </defs>
  <rect width="${imageWidth}" height="${imageHeight}" fill="url(#bgGradient)" />
  <g filter="url(#shadow)">
    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="10" ry="10" fill="${preset.windowBg}" />
  </g>
  <circle cx="${cardX + 20}" cy="${cardY + 22}" r="6" fill="#FF5F56"/>
  <circle cx="${cardX + 40}" cy="${cardY + 22}" r="6" fill="#FFBD2E"/>
  <circle cx="${cardX + 60}" cy="${cardY + 22}" r="6" fill="#27C93F"/>
  <text x="${cardX + 84}" y="${cardY + 27}" fill="${preset.titleText}" font-size="16" font-family="JetBrains Mono, Menlo, Consolas, monospace">${escapeXml(
    fileName,
  )}</text>
  ${linesSvg}
  ${footerSvg}
</svg>`;

  const outputPath = path.resolve(process.cwd(), options.output);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);

  if (typeof highlighter.dispose === "function") {
    highlighter.dispose();
  }

  if (clipboardMode === "path") {
    await clipboard.write(outputPath);
  }

  console.log(`Saved PNG: ${outputPath}`);
  if (clipboardMode === "path") {
    console.log("Copied output path to clipboard.");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

