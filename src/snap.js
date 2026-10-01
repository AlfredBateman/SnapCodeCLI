#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Command } from "commander";
import clipboard from "clipboardy";
import sharp from "sharp";
import { renderSvg, THEME_PRESETS } from "./core.js";

const program = new Command();

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

  if (!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
    console.error(`File not found or not a regular file: ${filePath}`);
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

  const code = fs.readFileSync(filePath, "utf8");
  if (code.includes("\0")) {
    console.error(`Binary file not supported: ${filePath}`);
    process.exit(1);
  }

  const svg = await renderSvg(code, {
    fileName: path.basename(filePath),
    theme: themeKey,
    footer: options.footer ? getGitBlameFooter(filePath) : null,
  });

  const outputPath = path.resolve(process.cwd(), options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outputPath);

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

