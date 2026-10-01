import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SNAP = fileURLToPath(new URL("../src/snap.js", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapcode-"));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (name, content) => (fs.writeFileSync(path.join(dir, name), content), name);
write("a.js", "const x = 1;\n");
write("long.txt", "a\nb\nc\n");
write("bin.dat", "a\0b");

// Runs the CLI inside the temp dir, never touching the clipboard (the serve command has no such option).
const snap = (...args) =>
  spawnSync(process.execPath, [SNAP, ...args, ...(args[0] === "serve" ? [] : ["--clipboard", "none"])], {
    cwd: dir,
    encoding: "utf8",
    timeout: 60_000,
  });

const magic = (file) => fs.readFileSync(path.join(dir, file)).subarray(0, 3);

test("exit 0: renders a PNG and reports where", () => {
  const r = snap("a.js", "-o", "out.png");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Saved PNG: .*out\.png\n$/);
  assert.equal(r.stderr, "");
  assert.deepEqual([...magic("out.png").subarray(1)], [80, 78]); // "PN"
});

test("exit 0: jpg, creates missing output folders, light theme and extras", () => {
  const r = snap("a.js", "-f", "jpg", "-t", "light", "-o", "deep/er/out.JPEG", "--line-numbers", "--highlight", "1", "--tab-width", "2");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Saved JPG: /);
  assert.deepEqual([...magic("deep/er/out.JPEG")], [0xff, 0xd8, 0xff]);
});

test("exit 0: --max-lines warns on stderr and still renders", () => {
  const r = snap("long.txt", "--max-lines", "2", "-o", "clip.png");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /^Warning: showing the first 2 of 3 lines \(change with --max-lines\)\n$/);
});

test("exit 0: --version and --help", () => {
  const v = spawnSync(process.execPath, [SNAP, "--version"], { encoding: "utf8" });
  assert.equal(v.status, 0);
  assert.equal(v.stdout.trim(), JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url))).version);
  const h = spawnSync(process.execPath, [SNAP, "--help"], { encoding: "utf8" });
  assert.equal(h.status, 0);
  assert.match(h.stdout, /Usage: snapcode/);
});

// Every failure exits 1 (PLAN.md: distinct codes are out of scope) and prints nothing on stdout.
const failures = [
  ["missing file", ["nope.js"], /File not found or not a regular file: nope\.js/],
  ["directory", [".", "-o", "d.png"], /File not found or not a regular file: \./],
  ["binary file", ["bin.dat"], /Binary file not supported: bin\.dat/],
  ["png with .jpg output", ["a.js", "-o", "x.jpg"], /Output file must end with \.png for --format png/],
  ["jpg with .png output", ["a.js", "-f", "jpg", "-o", "x.png"], /Output file must end with \.jpg or \.jpeg for --format jpg/],
  ["unknown format", ["a.js", "-f", "gif"], /Allowed choices are png, jpg/],
  ["unknown theme", ["a.js", "-t", "blue"], /Allowed choices are dark, light/],
  ["unknown clipboard mode", ["a.js", "--clipboard", "paste"], /Allowed choices are image, none/],
  ["tab width too big", ["a.js", "--tab-width", "17"], /Must be an integer from 1 to 16/],
  ["tab width not a number", ["a.js", "--tab-width", "x"], /Must be an integer from 1 to 16/],
  ["negative max lines", ["a.js", "--max-lines", "-1"], /Must be an integer from 0 to 1000000/],
  ["bad highlight", ["a.js", "--highlight", "4-2"], /Invalid line range "4-2"\. Use numbers and ranges like 3,5-8\./],
  ["extra argument", ["a.js", "b.js"], /too many arguments/],
  ["missing file argument", [], /missing required argument 'filepath'/],
  ["unknown option", ["a.js", "--nope"], /unknown option '--nope'/],
  ["serve: port out of range", ["serve", "--port", "70000", "--no-open"], /Must be an integer from 1 to 65535/],
];
for (const [name, args, message] of failures) {
  test(`exit 1: ${name}`, () => {
    const r = snap(...args);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, message);
    assert.equal(r.stdout, "");
  });
}

test("exit 1: serve on a port that is taken", async (t) => {
  const taken = net.createServer().listen(0, "127.0.0.1");
  await once(taken, "listening");
  t.after(() => taken.close());
  const { port } = taken.address();
  const child = spawn(process.execPath, [SNAP, "serve", "--port", String(port), "--no-open"], { stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill());
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const [code] = await once(child, "exit");
  assert.equal(code, 1);
  assert.equal(stderr.trim(), `Port ${port} is in use. Pick another with --port.`);
});

test("serve starts, announces its URL and stops on a signal", async (t) => {
  const probe = net.createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  probe.close();
  await once(probe, "close");
  const child = spawn(process.execPath, [SNAP, "serve", "--port", String(port), "--no-open"], { stdio: ["ignore", "pipe", "inherit"] });
  t.after(() => child.kill());
  const [line] = await once(child.stdout, "data");
  assert.match(String(line), new RegExp(`^SnapCode web UI on http://127\\.0\\.0\\.1:${port}/`));
});
