import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createServer, MAX_BYTES, MAX_COLUMNS } from "../src/server.js";

test("serves the page and renders PNGs, rejecting bad requests", async (t) => {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, type = "application/json") =>
    fetch(`${base}/render`, { method: "POST", headers: { "Content-Type": type }, body: JSON.stringify(body) });

  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<option value="typescript">TypeScript<\/option>/);
  assert.match(html, /value="light"/);
  assert.doesNotMatch(html, /\{\{\w+\}\}/);

  const ok = await post({ code: "a\n".repeat(150), language: "auto", theme: "light", fileName: "x.ts" });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/png");
  assert.equal(ok.headers.get("x-snapcode-lines"), "150");
  assert.equal(ok.headers.get("x-snapcode-clipped"), "1");
  assert.equal(ok.headers.get("x-snapcode-language"), "typescript");
  assert.deepEqual([...new Uint8Array(await ok.arrayBuffer()).slice(1, 4)], [80, 78, 71]); // "PNG"

  for (const [body, status] of [
    [{ code: 1 }, 400],
    [{ code: "x", theme: "blue" }, 400],
    [{ code: "x", theme: "constructor" }, 400],
    [{ code: "x", language: "toString" }, 400],
    [{ code: "x", fileName: "a".repeat(300) }, 400],
    [{ code: "a\0b" }, 422],
    [{ code: `ok\n${"x".repeat(MAX_COLUMNS + 1)}` }, 422],
    [{ code: "x".repeat(MAX_BYTES) }, 413],
  ]) {
    const res = await post(body);
    assert.equal(res.status, status, JSON.stringify(body).slice(0, 60));
    assert.ok((await res.json()).error);
  }
  assert.equal((await post({ code: "x" }, "text/plain")).status, 415);
  assert.equal((await fetch(`${base}/render`)).status, 405);
  assert.equal((await fetch(`${base}/nope`)).status, 404);

  // A rebinding attack arrives with a foreign Host header.
  const status = await new Promise((resolve, reject) =>
    http.get(`${base}/`, { headers: { Host: "evil.example" } }, (res) => resolve(res.statusCode)).on("error", reject),
  );
  assert.equal(status, 403);
});
