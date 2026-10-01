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
| Platforms and font (Q5) | Windows, macOS and Linux. Bundle one monospace font so layout is identical everywhere. CI on all three. |
| Alignment (Q9, F-04/F-05) | Top priority. Pixel-accurate layout from the bundled font's measured advance, code-point and wide-glyph aware. |
| npm publish (Q7) | Planned, as the last milestone. Name `snapcode-cli` is free. |
| Stray PNGs (Q4) | Delete `test.png`, `test-fixed.png`, `test-fixed2.png`, `timing.png`. Add `files` and `.gitignore`. |
| Performance priority | Startup time first (F-02: load one grammar). Large-file speed (F-01) is fixed as part of the quick wins. |

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
- Static, client-side, single page, no server
- Live preview (debounced)
- Copy image button

## Out of scope

- More themes, window title override, language override flag
- Custom background, custom padding, font size flag
- Config file
- SVG export
- Web UI: multiple pages, server mode (`snapcode serve`), theme picker, download button
- Distinct exit codes and `--quiet` (F-27)
- Expanding the language map beyond the F-15 fallback unless trivial

## Order of work

1. **Housekeeping**: delete stray PNGs, add `.gitignore` and `files`, `--version`, rename bin to `snapcode`.
2. **Quick wins**: remove the drop-shadow filter (F-01), load one grammar (F-02), `xml:space="preserve"` (F-03), trailing blank row (F-06), input validation (F-09), help-text fixes (F-11, F-12, F-14), delete dead code (F-16).
3. **Dependencies**: upgrade sharp to ^0.35.5 (F-19), set `engines.node` to `>=20` (F-23), then the other majors (F-20).
4. **Alignment**: bundle the font, measure glyph width, handle code points and wide glyphs (F-04, F-05).
5. **Refactor and tests**: extract `buildSvg` (F-17), add `node --test` and the CI matrix (F-18).
6. **Behaviour changes**: footer opt-in and parsing fix, image clipboard with safe failure, `--max-lines` clip, `--tab-width`.
7. **New CLI features**: line numbers, line highlighting, JPG export.
8. **Web UI**: single static page with live preview and copy image button, per DESIGN.md.
9. **Publish** to npm.
