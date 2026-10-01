#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Command, Option } from "commander";
import sharp from "sharp";
import { renderSvg, THEME_PRESETS } from "./core.js";

const program = new Command();
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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
      ["log", "-1", "--format=%an%x00%ad", "--date=short", "--", relPath],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .trim()
      .split("\0");

    if (info.length !== 2 || !info[0] || !info[1]) {
      return null;
    }

    return `Last edited by ${info[0]} on ${info[1]}`;
  } catch {
    return null;
  }
}

// The path is passed as an argument or env var, never through a shell.
function copyImageToClipboard(file) {
  const opts = { stdio: "ignore", timeout: 10000 };
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-STA",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms, System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile($env:SNAPCODE_PNG))",
      ],
      { ...opts, env: { ...process.env, SNAPCODE_PNG: file } },
    );
  } else if (process.platform === "darwin") {
    execFileSync(
      "osascript",
      [
        "-e", "on run argv",
        "-e", "set the clipboard to (read (POSIX file (item 1 of argv)) as «class PNGf»)",
        "-e", "end run",
        file,
      ],
      opts,
    );
  } else {
    try {
      execFileSync("wl-copy", ["--type", "image/png"], {
        ...opts,
        input: fs.readFileSync(file),
        stdio: ["pipe", "ignore", "ignore"],
      });
    } catch {
      execFileSync("xclip", ["-selection", "clipboard", "-t", "image/png", "-i", file], opts);
    }
  }
}

async function run() {
  program
    .name("snapcode")
    .version(pkg.version)
    .description("Generate syntax-highlighted PNG snapshots from source code files.")
    .argument("<filepath>", "Path to the source code file")
    .addOption(new Option("-t, --theme <theme>", "Theme variant").choices(Object.keys(THEME_PRESETS)).default("dark"))
    .option("-o, --output <file>", "Output PNG file name", "snapshot.png")
    .addOption(new Option("--clipboard <mode>", "Copy the image to the clipboard").choices(["image", "none"]).default("none"))
    .option("--footer", "Add a footer with the last git commit's author and date")
    .parse(process.argv);

  const filePath = program.args[0];
  const options = program.opts();

  if (!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
    console.error(`File not found or not a regular file: ${filePath}`);
    process.exit(1);
  }

  if (!String(options.output).toLowerCase().endsWith(".png")) {
    console.error("Output file must end with .png");
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, "utf8");
  if (code.includes("\0")) {
    console.error(`Binary file not supported: ${filePath}`);
    process.exit(1);
  }

  const svg = await renderSvg(code, {
    fileName: path.basename(filePath),
    theme: options.theme,
    footer: options.footer ? getGitBlameFooter(filePath) : null,
  });

  const outputPath = path.resolve(process.cwd(), options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outputPath);

  console.log(`Saved PNG: ${outputPath}`);

  if (options.clipboard === "image") {
    try {
      copyImageToClipboard(outputPath);
      console.log("Copied image to clipboard.");
    } catch (error) {
      console.error(`Warning: could not copy image to clipboard: ${error.message}`);
    }
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

