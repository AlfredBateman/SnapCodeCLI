# SnapCode CLI

Turn a source file into a syntax-highlighted PNG or JPG, styled like a code-screenshot card (macOS-style title bar, gradient background, soft shadow), straight from the terminal.

```text
snapcode src/snap.js  →  snapshot.png
```

## Requirements

- Node.js **22.12 or newer**.
- Git on `PATH` is optional; it is only used for `--footer`.
- Not on the npm registry yet. Install from source.

## Install

```bash
npm install     # from the repo root
npm link        # optional: puts `snapcode` on your PATH
```

## Quick start

```bash
# Dark theme (default), writes ./snapshot.png
snapcode ./index.js

# Light theme, custom output, copy the image to the clipboard, add the git footer
snapcode ./index.js -t light -o shots/index.png --clipboard image --footer

# JPG with line numbers and lines 3 and 5-8 highlighted, writes ./snapshot.jpg
snapcode ./index.js -f jpg --line-numbers --highlight 3,5-8

# Without linking
npm start -- ./index.js -o index.png
node src/snap.js ./index.js
```

On success it prints `Saved PNG: <absolute path>` (or `Saved JPG:`).

## Options

| Flag | Default | Description |
|---|---|---|
| `<filepath>` | required | Source file to render (exactly one) |
| `-t, --theme <dark\|light>` | `dark` | `dark` = Shiki `dracula`, `light` = `github-light` |
| `-f, --format <png\|jpg>` | `png` | Image format. JPG is written at quality 90 |
| `-o, --output <file>` | `snapshot.<format>` | Output path; must end in `.png`, or `.jpg`/`.jpeg` with `-f jpg`; missing folders are created; an existing file is overwritten |
| `--clipboard <image\|none>` | `none` | `image` copies the image itself to the clipboard. A clipboard failure only prints a warning |
| `--footer` | off | Add `Last edited by <author> on <date>` from the last git commit touching the file |
| `--tab-width <n>` | `4` | Columns per tab stop, 1 to 16 |
| `--max-lines <n>` | `100` | Render only the first `n` lines and warn on stderr; `0` renders everything |
| `--line-numbers` | off | Show right-aligned line numbers in a gutter |
| `--highlight <lines>` | none | Highlight lines, e.g. `3,5-8`. Lines past the end are ignored |
| `-V, --version` | | Print the version |
| `-h, --help` | | Show help |

See [docs/COMMANDS.md](docs/COMMANDS.md) for details and exit codes.

## Using the renderer from code

The SVG renderer has no filesystem or rasteriser dependency, so it also runs in a browser:

```js
import { renderSvg } from "snapcode-cli";

const svg = await renderSvg(code, { fileName: "app.ts", theme: "dark", footer: null, tabWidth: 4 });
// Options also take language (a Shiki id; detected from fileName when omitted), lineNumbers and highlight.
```

## Behaviour worth knowing

- Language comes from Shiki's own language ids and aliases (so `.lua`, `.vue`, `.ps1`, `Dockerfile`, `Makefile` all work), plus a short override map for names Shiki does not alias. Anything else renders as plain text.
- Tabs advance to the next tab stop (every 4 columns unless `--tab-width` says otherwise). A final newline does not add a blank row.
- Only the grammar and theme the file needs are loaded: a one-line file renders in about 0.5 s.
- Columns line up on every OS: each character sits on a fixed 14.4 px grid, and CJK, fullwidth and emoji take two cells. The font is not bundled (the SVG asks for `JetBrains Mono, Menlo, Consolas, monospace`), so glyph shapes differ per OS. CJK and emoji need a system font that has them, and joined emoji such as 👨‍👩‍👧 render as separate glyphs in the PNG because librsvg does not join them.
- Long files are clipped to 100 lines by default (`--max-lines`). Width is not capped, so minified one-liners still make very wide images.

## Development

```bash
npm test        # node --test
```

## Documentation

- [docs/COMMANDS.md](docs/COMMANDS.md): full reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it works
- [CONTRIBUTING.md](CONTRIBUTING.md): dev setup
- [AUDIT_REPORT.md](AUDIT_REPORT.md): known issues and roadmap

## License

MIT. See [LICENSE](LICENSE).
