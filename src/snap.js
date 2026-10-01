#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { Command, InvalidArgumentError, Option } from "commander";
import sharp from "sharp";
import { clipLines, parseLineRanges, renderSvg, THEME_PRESETS } from "./core.js";

const program = new Command();
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function getGitBlameFooter(filePath) {
  const absPath = path.resolve(filePath);

  try {
    const info = execFileSync(
      "git",
      ["log", "-1", "--format=%an%x00%ad", "--date=short", "--", absPath],
      {
        cwd: path.dirname(absPath),
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

function integer(min, max) {
  return (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new InvalidArgumentError(`Must be an integer from ${min} to ${max}.`);
    }
    return n;
  };
}

// The path is passed as an argument or env var, never through a shell.
function copyImageToClipboard(file, format) {
  const opts = { stdio: "ignore", timeout: 10000 };
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-STA",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms, System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile($env:SNAPCODE_IMAGE))",
      ],
      { ...opts, env: { ...process.env, SNAPCODE_IMAGE: file } },
    );
  } else if (process.platform === "darwin") {
    execFileSync(
      "osascript",
      [
        "-e", "on run argv",
        "-e", `set the clipboard to (read (POSIX file (item 1 of argv)) as ${format === "jpg" ? "JPEG picture" : "«class PNGf»"})`,
        "-e", "end run",
        file,
      ],
      opts,
    );
  } else {
    try {
      execFileSync("wl-copy", ["--type", mime], {
        ...opts,
        input: fs.readFileSync(file),
        stdio: ["pipe", "ignore", "ignore"],
      });
    } catch {
      execFileSync("xclip", ["-selection", "clipboard", "-t", mime, "-i", file], opts);
    }
  }
}

function openBrowser(url) {
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true, windowsHide: true })
    .on("error", () => console.error(`Could not open a browser. Visit ${url}`))
    .unref();
}

async function serve({ port, open }) {
  const { createServer } = await import("./server.js");
  const server = createServer();
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? `Port ${port} is in use. Pick another with --port.` : error.message);
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`SnapCode web UI on ${url} (Ctrl+C to stop)`);
    if (open) openBrowser(url);
  });
}

async function snap(filePath, options) {
  if (!fs.statSync(filePath, { throwIfNoEntry: false })?.isFile()) {
    console.error(`File not found or not a regular file: ${filePath}`);
    process.exit(1);
  }

  const output = options.output ?? `snapshot.${options.format}`;
  const extensions = options.format === "jpg" ? [".jpg", ".jpeg"] : [".png"];
  if (!extensions.includes(path.extname(output).toLowerCase())) {
    console.error(`Output file must end with ${extensions.join(" or ")} for --format ${options.format}`);
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, "utf8");
  if (code.includes("\0")) {
    console.error(`Binary file not supported: ${filePath}`);
    process.exit(1);
  }

  const clip = clipLines(code, options.maxLines);
  if (clip.clipped) {
    console.error(`Warning: showing the first ${options.maxLines} of ${clip.lines} lines (change with --max-lines)`);
  }

  const svg = await renderSvg(clip.code, {
    fileName: path.basename(filePath),
    theme: options.theme,
    footer: options.footer ? getGitBlameFooter(filePath) : null,
    tabWidth: options.tabWidth,
    lineNumbers: Boolean(options.lineNumbers),
    highlight: options.highlight,
  });

  const outputPath = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const image = sharp(Buffer.from(svg));
  await (options.format === "jpg" ? image.jpeg({ quality: 90 }) : image.png()).toFile(outputPath);

  console.log(`Saved ${options.format.toUpperCase()}: ${outputPath}`);

  if (options.clipboard === "image") {
    try {
      copyImageToClipboard(outputPath, options.format);
      console.log("Copied image to clipboard.");
    } catch (error) {
      console.error(`Warning: could not copy image to clipboard: ${error.message}`);
    }
  }
}

program
  .name("snapcode")
  .version(pkg.version)
  .description("Generate syntax-highlighted PNG or JPG snapshots from source code files.")
  .argument("<filepath>", "Path to the source code file")
  .addOption(new Option("-t, --theme <theme>", "Theme variant").choices(Object.keys(THEME_PRESETS)).default("dark"))
  .addOption(new Option("-f, --format <format>", "Image format").choices(["png", "jpg"]).default("png"))
  .option("-o, --output <file>", "Output file name (default: snapshot.<format>)")
  .addOption(new Option("--clipboard <mode>", "Copy the image to the clipboard").choices(["image", "none"]).default("none"))
  .option("--footer", "Add a footer with the last git commit's author and date")
  .option("--tab-width <n>", "Columns per tab stop (1-16)", integer(1, 16), 4)
  .option("--max-lines <n>", "Render at most this many lines, 0 for all", integer(0, 1_000_000), 100)
  .option("--line-numbers", "Show line numbers")
  .option("--highlight <lines>", "Highlight lines, e.g. 3,5-8", (value) => {
    try {
      return parseLineRanges(value);
    } catch (error) {
      throw new InvalidArgumentError(`${error.message}. Use numbers and ranges like 3,5-8.`);
    }
  })
  .action(snap);

program
  .command("serve")
  .description("Open the web UI, served on 127.0.0.1 only")
  .option("-p, --port <n>", "Port to listen on", integer(1, 65535), 3333)
  .option("--no-open", "Do not open the browser")
  .action(serve);

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

