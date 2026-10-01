# Changelog

## 0.2.0 - 2026-10-02

First tagged release. `package.json` said 1.0.0 before; nothing was published under that number.

### Added
- `snapcode serve [-p, --port] [--no-open]`: web UI on 127.0.0.1 that renders through the same core and sharp as the CLI.
- `--line-numbers`, `--highlight <lines>`, `--tab-width <n>`, `--max-lines <n>`, `-f jpg`, `--clipboard image`, `--footer`, `--version`.
- `node --test` suite (36 tests) and a Windows/macOS/Linux CI matrix on Node 22 and 24.
- `npm run dev`: the web UI server in watch mode.
- `LICENSE`, `.gitignore`, `docs/`, `CONTRIBUTING.md`.

### Changed
- The command is `snapcode` (was `snap`).
- Requires Node 22.12 or newer.
- Layout puts every grapheme on a fixed 14.4 px grid, so CJK and emoji line up.
- The git footer is opt-in and uses one `git log` call.
- Clipboard copies the image and only warns on failure. Long files are clipped to 100 lines with a warning.
- Dependencies: shiki 4, commander 15, sharp 0.35.5; clipboardy removed.

### Removed
- The `snap` npm script (use `npm start`).

### Fixed
- Slow renders (SVG drop-shadow filter removed, one grammar loaded), dropped spaces, trailing blank row, footer lost for authors with `|` in their name, raw errors for directories and binary files.
- The published tarball is 7 files (`src`, README, LICENSE, package.json), 16 kB.

See [AUDIT_REPORT.md](AUDIT_REPORT.md) for the findings behind these fixes and what remains.
