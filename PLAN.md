# PLAN

Decisions from the AUDIT_REPORT.md open questions and the scoping interview (2026-10-01). Finding IDs (F-xx) and questions (Qx) refer to [AUDIT_REPORT.md](AUDIT_REPORT.md). Process rules are in [CLAUDE.md](CLAUDE.md); web UI work follows [DESIGN.md](DESIGN.md).

## Decisions made

| Topic | Decision |
|---|---|
| Bin name (Q1, F-24) | Rename `snap` to `snapcode`. Update README and docs. |
| Git footer (Q2, F-25) | Opt-in, off by default, enabled with a flag. Also fix the `\|` parsing bug (F-07). |
| Clipboard (Q3, F-08) | Copy the **image** itself, opt-in, default `none`. A clipboard failure warns on stderr and exits 0. |
| Large files (Q6, F-26) | Clip with a warning (default about 100 lines, `--max-lines` to override). |
| Tab width (Q8) | New `--tab-width`, default 4. |
| Node floor (F-23) | `engines.node >=22.12` (Node 20 is EOL; commander 15 needs 22.12). |
| Platforms and font (Q5) | Windows, macOS and Linux. CI on all three. No bundled font: librsvg ignores `@font-face`, and grid placement makes columns identical without one (glyph shapes still vary by OS). |
| Alignment (Q9, F-04/F-05) | Done. Every grapheme is anchored to a 14.4 px cell grid; CJK, fullwidth and emoji take two cells. See docs/ARCHITECTURE.md. |
| npm publish (Q7) | Planned, as the last milestone. Name `snapcode-cli` is free. |
| Stray PNGs (Q4) | Delete `test.png`, `test-fixed.png`, `test-fixed2.png`, `timing.png`. Add `files` and `.gitignore`. |
| Performance priority | Startup time first (F-02: load one grammar). Large-file speed (F-01) is fixed as part of the quick wins. |
| Web UI shape (2026-10-01) | Replaces the earlier static, no-server plan: `snapcode serve [--port]` runs a `node:http` server on 127.0.0.1 that renders through core and sharp, so web PNGs match the CLI. The page gets language and theme controls and a download button. Still comes after steps 6–7. |

## In scope

CLI
- Line numbers (`--line-numbers`)
- Line highlighting (`--highlight 3,5-8`)
- JPG export (`--format jpg`)
- Copy image to clipboard (opt-in)
- `--tab-width`, `--max-lines`
- All audit quick wins and bug fixes (F-01 to F-03, F-06 to F-14, F-16, F-19, F-21 to F-23)
- Test suite (`node --test`) and CI matrix (F-18); extract `buildSvg` (F-17)

Web UI
- `snapcode serve [--port]`: `node:http`, bound to 127.0.0.1, one static page plus a render endpoint that reuses core; body size limit, input validation, opens the browser
- Single page: paste or drop code, language and theme controls, live preview (debounced), download PNG
- Vanilla HTML/CSS/JS, no build step; responsive and keyboard accessible

## Out of scope

- More themes, window title override, language override flag
- Custom background, custom padding, font size flag
- Config file
- SVG export
- Web UI: multiple pages, frontend framework, copy image button
- Distinct exit codes and `--quiet` (F-27)
- Expanding the language map beyond the F-15 fallback unless trivial

## Order of work

1. **Housekeeping**: delete stray PNGs, add `.gitignore` and `files`, `--version`, rename bin to `snapcode`.
2. **Quick wins**: remove the drop-shadow filter (F-01), load one grammar (F-02), `xml:space="preserve"` (F-03), trailing blank row (F-06), input validation (F-09), help-text fixes (F-11, F-12, F-14), delete dead code (F-16).
3. **Dependencies**: upgrade sharp to ^0.35.5 (F-19), set `engines.node` to `>=22.12` (F-23), then the other majors (F-20).
4. **Alignment**: anchor each grapheme to a cell grid, handle code points and wide glyphs (F-04, F-05). Done.
5. **Refactor and tests**: extract `buildSvg` (F-17), add `node --test` and the CI matrix (F-18).
6. **Behaviour changes**: footer opt-in and parsing fix, image clipboard with safe failure, `--max-lines` clip, `--tab-width`. Done.
7. **New CLI features**: line numbers, line highlighting, JPG export. Done.
8. **Web UI**: `snapcode serve` with a single page, live preview, language and theme controls and PNG download, per DESIGN.md. Done.
9. **Publish** to npm.
