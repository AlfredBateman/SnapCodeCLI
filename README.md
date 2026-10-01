# SnapCode CLI

Turn a source file into a syntax-highlighted PNG, styled like a code-screenshot card (macOS-style title bar, gradient background, soft shadow), straight from the terminal.

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

# Without linking
npm start -- ./index.js -o index.png
node src/snap.js ./index.js
```

On success it prints `Saved PNG: <absolute path>`.

## Options

| Flag | Default | Description |
|---|---|---|
| `<filepath>` | required | Source file to render (exactly one) |
| `-t, --theme <dark\|light>` | `dark` | `dark` = Shiki `dracula`, `light` = `github-light` |
| `-o, --output <file>` | `snapshot.png` | Output path; must end in `.png`; missing folders are created; an existing file is overwritten |
| `--clipboard <image\|none>` | `none` | `image` copies the PNG itself to the clipboard. A clipboard failure only prints a warning |
| `--footer` | off | Add `Last edited by <author> on <date>` from the last git commit touching the file |
| `-V, --version` | | Print the version |
| `-h, --help` | | Show help |

See [docs/COMMANDS.md](docs/COMMANDS.md) for details and exit codes.

## Using the renderer from code

The SVG renderer has no filesystem or rasteriser dependency, so it also runs in a browser:

```js
import { renderSvg } from "snapcode-cli";

const svg = await renderSvg(code, { fileName: "app.ts", theme: "dark", footer: null });
```

## Behaviour worth knowing

- Language comes from Shiki's own language ids and aliases (so `.lua`, `.vue`, `.ps1`, `Dockerfile`, `Makefile` all work), plus a short override map for names Shiki does not alias. Anything else renders as plain text.
- Tabs are replaced with two spaces. A final newline does not add a blank row.
- Only the grammar and theme the file needs are loaded: a one-line file renders in about 0.5 s.
- The font is not bundled yet: the SVG asks for `JetBrains Mono, Menlo, Consolas, monospace` and the canvas width assumes a 14 px glyph advance, so very long lines can be cut off or padded depending on the installed font. Wide glyphs (CJK, emoji) are not measured. See [AUDIT_REPORT.md](AUDIT_REPORT.md) F-04/F-05.
- Image size is not capped yet; very long files make very tall images.

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
