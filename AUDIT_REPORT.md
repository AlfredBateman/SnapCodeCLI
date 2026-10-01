# SnapCodeCLI Audit Report

Audit date: 2026-10-01 · Platform: Windows 11 Pro, Node 22.22.2, npm 12.0.2, git 2.49.0 · Source files changed: none.

**Evidence labels used below:** **[V]** verified by running it · **[R]** verified by reading the code · **[I]** inferred, not run.

## 1. Summary

**What it is.** `snap` is a small Node CLI (one 285-line file, `src/snap.js`) that renders a source file to a styled PNG: Shiki tokenises the code, it is laid out as SVG on a fixed character grid, and sharp rasterises it. Four runtime dependencies. No tests, lint, CI, or git history in this folder.

**Overall health: works for small files on a good day, not ready to publish.** The code is tidy and the security posture is sound, but there are real rendering bugs, one severe performance trap, no safety net, and a vulnerable dependency.

**Top 5 issues**

1. **F-01: a 285-line file takes ~70 s** to render; the SVG drop-shadow filter on a ~10,000 px tall image is ~66 s of it. [V]
2. **F-03: spaces at the start of tokens are dropped** while the x-position still advances, so text spacing is visibly wrong (`-Auto`, gaps inside `import fs  from`). [V]
3. **F-04/F-05: layout assumes a 14 px glyph advance** for whatever font is installed, and counts UTF-16 units, so alignment is wrong on some systems and for CJK/emoji. [V for emoji, I for per-OS font]
4. **F-18: zero tests, lint or CI.** `npm test` fails. [V]
5. **F-19: `npm audit` reports 1 high-severity advisory** in sharp 0.33.5 (fixed in 0.35.5). Practical exposure is low here. [V]

## 2. Findings

Line numbers refer to `src/snap.js` unless a file is named.

| ID | Area | Severity | File:line | Description | Suggested fix | Effort |
|---|---|---|---|---|---|---|
| F-01 | Performance | High | 246-251 | `feDropShadow` filter makes sharp/librsvg take ~66 s on a 2500×10000 canvas vs 0.29 s without it; my 285-line self-snapshot took 70 s, 2nd run 70 s. [V] | Drop the SVG filter; draw a few offset translucent rects or composite a blurred shadow with sharp after rendering. Cap image height. | S |
| F-02 | Performance | Medium | 167-170 | Loads all 303 `bundledLanguages` every run: ~3.9 s vs 52 ms for one language; a 1-line file takes ~4 s total. [V] | Load only `language` (and `plaintext`); `langs: [language]`. | S |
| F-03 | Correctness | High | 226 | SVG `<text>` collapses leading/trailing whitespace but `x` advances by `token.content.length * 14` (223), so tokens such as `" from"` or `"- "` lose their space and everything after shifts. Visible in `import fs  from`, `-Auto language`. [V] | Add `xml:space="preserve"` (or `style="white-space:pre"`) on each `<text>`; better, one `<text>` per line with `<tspan>`s. | S |
| F-04 | Correctness / Platform | Medium | 188, 223, 226 | `charWidth = 14` is hardcoded for a 24 px font, but the stack `JetBrains Mono, Menlo, Consolas, monospace` is not bundled. JetBrains Mono's advance is 0.6 em = 14.4 px; Consolas 0.55 em = 13.2 px. Drift grows with line length and differs per OS. [R for the constants; I for per-font numbers; only Windows tried] | Bundle one font and embed it, or measure width with the font; at minimum make the stack match the 14 px assumption. | M |
| F-05 | Correctness | Medium | 194-197, 223 | Width uses `String.length`, so wide glyphs (CJK, emoji) take 1 cell and overlap neighbours; emoji covered the closing quote in my test. Canvas width (194-199) is also under-sized for such lines. [V] | Count code points with a display-width helper (e.g. `string-width`) or measure glyphs. | M |
| F-06 | Correctness | Low | 184, 204 | A file ending in a newline yields a trailing empty token line, so every image has an extra blank row. [R for cause; visible as extra bottom padding in the crlf and uni renders] | Drop a final empty line before layout. | S |
| F-07 | Correctness | Medium | 92-104 | Footer parses `git log` output with `split("\|")`; an author whose name contains `\|` yields 3 parts and the footer is silently dropped (confirmed with `Ann\|Lee`). Also shows last *commit*, not uncommitted edits. [V for `\|`, R for the rest] | Use a safer separator (`%x00`) and `--format=%an%x00%ad`; consider noting "uncommitted changes". | S |
| F-08 | Platform / Error handling | Medium | 271-276 | Clipboard write is awaited with no local handling and happens before the success message; a failing clipboard (headless Linux/SSH/WSL) would make the run exit 1 and skip `Saved PNG` although the PNG exists. **I never ran the clipboard path** (all runs used `--clipboard none`). [I] | `try/catch` around the write, warn on stderr, keep exit 0; print `Saved PNG` first. Reconsider the default. | S |
| F-09 | UX / Error handling | Medium | 140, 162, 265 | Only `existsSync` is checked. Directory input → raw `EISDIR: illegal operation on a directory, read`; binary input → `glib: XML parse error ... Char value 0`; missing output folder → sharp's `unable to open for write ... windows error: ...`. [V] | `statSync().isFile()`, reject NUL bytes, `mkdirSync(dirname, {recursive:true})` or a clear message. | S |
| F-10 | UX | Low | 115-117 | No `.version()`, so `snap --version` exits 1 with `unknown option`. [V] | `.version(pkg.version)`. | S |
| F-11 | UX | Low | 121-125 | Clipboard default shown twice in help (`(default: path) (default: "path")`). [V] | Remove "(default: path)" from the description string. | S |
| F-12 | UX | Low | 132 | Extra positionals are ignored: `snap a.js b.js` renders `a.js` only. [V] | `.allowExcessArguments(false)` or accept multiple files. | S |
| F-13 | UX | Low | 264-265 | Existing output file is overwritten without notice; default `snapshot.png` makes this likely. [R] | Document, or add `--force`/timestamped default. | S |
| F-14 | Code quality | Low | 145-160 | Manual validation of enumerated options; help text does not list valid values in a machine-consistent way. [R] | commander `.choices([...])`. | S |
| F-15 | Correctness / UX | Low | 13-47, 75-78 | 33 extensions only, lookup is extension-based, so `Dockerfile`, `Makefile`, `.vue`, `.lua`, `.ps1`, etc. render as plain text. Shiki supports many more. [R; Dockerfile render not inspected] | Fall back to Shiki's own alias/extension list or add file-name map. | S |
| F-16 | Code quality | Low | 135-138, 172-183 | Dead code: `<filepath>` is required by commander (missing arg errors before this check) [V]; the plaintext fallback cannot trigger because every grammar is preloaded and unmapped languages already resolve to `plaintext`. [R] | Delete both. | S |
| F-17 | Code quality | Low | 114-279 | One 165-line `run()` mixes parsing, validation, layout, SVG strings and I/O. Untestable as is. Theme names are listed twice (49-64 vs 168). [R] | Split into `buildSvg(tokens, preset, opts)` plus thin CLI. | M |
| F-18 | Testing | High | package.json:9-12 | No `test` script, no tests, no linter, no CI. `npm test` → `Missing script: "test"`. Only manual checks exist. [V] | Add `node --test` with SVG golden tests and CLI exit-code tests; add a GitHub Actions matrix (win/mac/linux). | M |
| F-19 | Dependencies | High (per npm) | package.json:29 | `npm audit`: sharp ≤0.35.4 inherits libvips CVE-2026-33327/33328/35590/35591 and libheif advisories; fix is 0.35.5 (semver-major). Exposure is low since only self-generated SVG is rasterised. [V for audit, I for exposure] | Upgrade to sharp ^0.35.5 and re-test. | S |
| F-20 | Dependencies | Medium | package.json:27-30 | All four deps are a major version behind. Installed → latest: clipboardy 4.0.0 → 5.3.2, commander 12.1.0 → 15.0.0, sharp 0.33.5 → 0.35.5, shiki 1.29.2 → 4.5.0. [V] | Upgrade incrementally, sharp first; shiki 1→4 needs a check of `createHighlighter` API. | M |
| F-21 | Packaging | Medium | package.json (no `files`) | `npm pack --dry-run` includes `test-fixed.png`, `test-fixed2.png`, `timing.png` (identical 1.4 MB files, byte-compared) and `test.png`: 3.9 MB tarball for 8.5 kB of code. Folder has no `.gitignore`. [V] | Add `"files": ["src"]`, delete the PNGs, add `.gitignore`. | S |
| F-22 | Packaging | Low | package.json:21-22 | `"license": "MIT"` but no `LICENSE` file; empty `author`; no `repository`, `homepage`, `bugs`. [V] | Add LICENSE and metadata. | S |
| F-23 | Packaging | Low | package.json:23-25 | `engines.node >=18` is looser than sharp 0.33's `^18.17 \|\| ^20.3 \|\| >=21`; Node 18 is EOL. [V for sharp's engines] | Set `>=20` (or what you intend to support). | S |
| F-24 | Packaging / UX | Medium | package.json:6-8 | bin name `snap` collides conceptually with other tools: `npm view snap` returns an unrelated package ("Simple and flexible boilerplate management") [V], so `npx snap` outside this folder runs the wrong thing; Ubuntu's `snap` package manager shares the name [I]. `snapcode-cli` itself is not on npm (404) [V]. | Rename the bin (e.g. `snapcode`), fix README. | S |
| F-25 | Privacy / UX | Low | 126-129, 202 | Footer (author real name from git) is on by default and baked into an image people typically share. [R] | Make opt-in, or confirm intent (Open question Q2). | S |
| F-26 | Robustness | Low | 199-206 | No limit on image size; 285 lines × 160 cols produced 2420×9948 px. Long files or minified one-liners will produce huge PNGs (and trigger F-01). [V for size] | Add `--max-lines`/clip with a warning. | S |
| F-27 | UX | Low | 142, 148, 153, 159, 283 | Every failure exits 1; no distinct codes, no `--quiet`. [R] | Optional: separate codes for usage vs runtime errors. | S |
| F-28 | Security | Info | 85-103 | **No injection issues found.** `execFileSync` with argument arrays and `--`, no shell; all text interpolated into SVG goes through `escapeXml` (66-73, 222, 232-236, 257-259). No `eval`, no secrets, no network access. [R] | none | none |

## Status at 0.2.0 (2026-10-02)

The tables above describe the code as audited on 2026-10-01. Checked against the code, tests and `npm audit`/`npm pack --dry-run` now:

**Fixed (25 of 28):** F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-14, F-15, F-16, F-17, F-18, F-19, F-20, F-21, F-22, F-23, F-24, F-25, F-28 (nothing to fix).

**Remain (3):**

| ID | State |
|---|---|
| F-13 | Accepted. An existing output file is still overwritten silently; README and docs/COMMANDS.md say so. |
| F-26 | Partly. `--max-lines` (default 100) clips tall files, but width is not capped in the CLI, so a minified one-liner still makes a very wide image. The web UI refuses lines over 300 characters. |
| F-27 | Out of scope per PLAN.md. Every failure still exits 1; there is no `--quiet`. |

How the big ones were fixed: F-01 no SVG filter; F-02 shiki loads one grammar; F-03/F-04/F-05 every grapheme is anchored to a 14.4 px cell (glyph shapes still depend on the installed font); F-17/F-18 `renderSvg` lives in `src/core.js` with 36 `node --test` tests and a Windows/macOS/Linux CI matrix; F-19/F-20 sharp 0.35.5, shiki 4.5, commander 15, clipboardy removed, `npm audit` reports 0 vulnerabilities; F-21 `files: ["src"]` makes the tarball 7 files, 16 kB; F-24 the bin is `snapcode`.

## 3. What's working well

- Core path works: dark and light themes, CRLF, empty file, unicode text, git footer in a real repo all produced valid PNGs. [V]
- Clean validation messages for the common mistakes (missing file, theme, extension, clipboard mode), all exit 1. [V]
- Safe handling of untrusted strings: XML escaping everywhere and no shell. [R]
- Footer degrades gracefully when git is absent or the file is untracked. [R]
- Small, readable, dependency-light code; ES modules; lockfile present.
- Output visually matches the stated goal (title bar, gradient, rounded card) for typical small files. [V]

## 4. Improvement roadmap

**Quick wins (hours)**
- F-01 remove/replace the drop-shadow filter; F-02 load one grammar; F-03 `xml:space="preserve"`.
- F-21 add `files`, delete stray PNGs, add `.gitignore`; F-22 add LICENSE; F-19 upgrade sharp.
- F-09, F-10, F-11, F-12, F-16 are one-line fixes each.

**Medium term (days)**
- F-18 add `node --test` suite and CI on Windows/macOS/Linux; extract `buildSvg` (F-17) to make that possible.
- F-04/F-05 fix text measurement (bundle a font, measure width).
- F-08 harden the clipboard step; F-24 rename the binary; F-20 update remaining deps.

**Long term**
- Decide on supported languages/themes policy (F-15), config file or flags for font size, padding, line numbers; consider max-size/wrapping strategy (F-26); publish to npm with provenance once the above is done.

## 5. Open questions for you

1. **Q1.** Is `snap` meant to be the permanent command name, given the collision in F-24?
2. **Q2.** Should the git footer be on by default (F-25)? Is "last commit author" the intended meaning of "Last edited by"?
3. **Q3.** Why does `--clipboard` copy the output *path* rather than the image? Is image-to-clipboard a goal?
4. **Q4.** What are `test.png` (130×14 px, near-empty), `test-fixed.png`, `test-fixed2.png` and `timing.png`? They look like leftovers from an earlier debugging/timing session. Safe to delete?
5. **Q5.** Intended platforms: Windows only, or macOS/Linux too? Is JetBrains Mono expected to be installed on user machines, or should a font be bundled?
6. **Q6.** Are very large inputs in scope? Should they be clipped, wrapped or rejected?
7. **Q7.** Is publishing to npm planned? The `package.json` name `snapcode-cli` is free.
8. **Q8.** Why tabs → 2 spaces (162) rather than a configurable width? Intentional?
9. **Q9.** Is the README's "high-quality" claim meant to include pixel-accurate alignment? That decides the priority of F-04/F-05.

## 6. What I could not verify, and why

- **macOS and Linux behaviour.** Only Windows 11 was available. F-04 (per-OS font), F-08 (headless clipboard) and F-24 (Ubuntu `snap`) are inferred.
- **The clipboard path.** Every run used `--clipboard none` to avoid altering your clipboard, so `clipboardy.write` never executed.
- **`npm link` / global install and `npx snap`** behaviour. Not run (would modify global state); README steps are from reading `package.json`.
- **Which font was actually used** in my renders, and exact glyph advances for JetBrains Mono/Consolas (figures in F-04 are from font design knowledge, not measured).
- **Sharp 0.35.5 / Shiki 4 compatibility.** I did not upgrade (no source or lockfile changes allowed), so effort estimates for F-19/F-20 are guesses.
- **Whether the sharp advisory is reachable.** Judged from code (input is only self-built SVG); the advisory text was taken from `npm audit` output only.
- **Performance beyond one machine.** Timings (4 s baseline, 70 s large file) are single measurements on one PC. The cause of the 66 s was isolated by benchmark, not by profiler.
- **Other language renders** (Dockerfile output was produced but not inspected; only code reading says it falls to plain text).
- **Git edge cases:** renamed files, submodules, shallow clones, files outside the repo root.
- **CI, coverage, flakiness:** nothing exists to run.
