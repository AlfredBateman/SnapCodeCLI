import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import sharp from "sharp";
import { bundledLanguages, bundledLanguagesInfo } from "shiki";
import { clipLines, detectLanguage, renderSvg, THEME_PRESETS } from "./core.js";

export const MAX_BYTES = 256 * 1024;
export const MAX_LINES = 100;
// ponytail: librsvg time grows faster than the glyph count (100 x 400 chars takes about 5 s), so long lines are
// refused rather than clipped; raise it if rendering gets cheaper.
export const MAX_COLUMNS = 300;

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const LANGUAGE_OPTIONS = [...bundledLanguagesInfo]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(({ id, name }) => `<option value="${id}">${escapeHtml(name)}</option>`)
  .join("");

// Alias or id -> id, so the page can name the detected language ("py" -> "python").
const LANGUAGE_IDS = new Map(bundledLanguagesInfo.flatMap(({ id, aliases = [] }) => [id, ...aliases].map((a) => [a, id])));

const THEME_OPTIONS = Object.keys(THEME_PRESETS)
  .map(
    (key, i) =>
      `<label class="tab"><input type="radio" name="theme" value="${key}"${i ? "" : " checked"}><span>${
        key[0].toUpperCase() + key.slice(1)
      }</span></label>`,
  )
  .join("");

const PAGE = fs
  .readFileSync(new URL("./index.html", import.meta.url), "utf8")
  .replace("{{languages}}", LANGUAGE_OPTIONS)
  .replace("{{themes}}", THEME_OPTIONS)
  .replace("{{maxBytes}}", MAX_BYTES)
  .replace("{{maxLines}}", MAX_LINES);

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readBody(req) {
  if (Number(req.headers["content-length"]) > MAX_BYTES) throw new HttpError(413, "The code is larger than 256 KB.");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new HttpError(413, "The code is larger than 256 KB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Body: { code, language: "auto" | shiki id, theme, fileName }. Returns PNG bytes and what was rendered.
async function renderRequest(body) {
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
  const { code, language = "auto", theme = "dark", fileName = "" } = input ?? {};
  if (typeof code !== "string") throw new HttpError(400, "code must be a string.");
  if (code.includes("\0")) throw new HttpError(422, "Binary content is not supported.");
  if (typeof theme !== "string" || !Object.hasOwn(THEME_PRESETS, theme)) throw new HttpError(400, "Unknown theme.");
  if (typeof language !== "string" || (language !== "auto" && !Object.hasOwn(bundledLanguages, language))) {
    throw new HttpError(400, "Unknown language.");
  }
  if (typeof fileName !== "string" || fileName.length > 255) throw new HttpError(400, "fileName must be a short string.");

  const name = path.basename(fileName);
  const lang = language === "auto" ? detectLanguage(name) : language;
  const clip = clipLines(code, MAX_LINES);
  const long = clip.code.split(/\r?\n/).findIndex((line) => line.length > MAX_COLUMNS);
  if (long !== -1) {
    throw new HttpError(422, `Line ${long + 1} is longer than ${MAX_COLUMNS} characters. Wrap or shorten it to render.`);
  }
  const svg = await renderSvg(clip.code, { fileName: name, language: lang, theme });
  try {
    return { png: await sharp(Buffer.from(svg)).png().toBuffer(), lines: clip.lines, clipped: clip.clipped, language: LANGUAGE_IDS.get(lang) ?? lang };
  } catch (error) {
    throw new HttpError(422, `The image is too large to render (${error.message}). Try shorter lines.`);
  }
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const send = (status, type, body, extra = {}) => {
      res.writeHead(status, { ...HEADERS, "Content-Type": type, ...extra });
      res.end(body);
    };
    const fail = (status, message) => send(status, "application/json", JSON.stringify({ error: message }));

    try {
      // Only answer to our own address, so other sites cannot reach us through DNS rebinding.
      const { port } = server.address();
      if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return fail(403, "Forbidden host.");

      const { pathname } = new URL(req.url, "http://localhost");
      if (pathname === "/") {
        if (req.method !== "GET" && req.method !== "HEAD") return fail(405, "Use GET.");
        return send(200, "text/html; charset=utf-8", req.method === "HEAD" ? "" : PAGE);
      }
      if (pathname === "/render") {
        if (req.method !== "POST") return fail(405, "Use POST.");
        // A JSON content type cannot be sent cross-site without a CORS preflight, which we never grant.
        if (!/^application\/json\b/.test(req.headers["content-type"] ?? "")) return fail(415, "Send application/json.");
        const out = await renderRequest(await readBody(req));
        return send(200, "image/png", out.png, {
          "X-Snapcode-Lines": out.lines,
          "X-Snapcode-Clipped": out.clipped ? "1" : "0",
          "X-Snapcode-Language": out.language,
        });
      }
      return fail(404, "Not found.");
    } catch (error) {
      if (error instanceof HttpError) {
        res.setHeader("Connection", "close"); // stop reading an oversized body
        return fail(error.status, error.message);
      }
      console.error(error);
      return fail(500, "Rendering failed. See the terminal for details.");
    }
  });
  return server;
}
