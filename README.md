# SnapCode CLI

Turn a source file into a syntax-highlighted PNG, styled like a code-screenshot card (macOS-style title bar, gradient background, drop shadow), straight from the terminal.

```text
snap src/snap.js  →  snapshot.png
```

## Requirements

- Node.js **18.17 or newer** (the `engines` field in `package.json` says `>=18`, but the `sharp` dependency needs `^18.17 || ^20.3 || >=21`).
- Git on `PATH` is optional; it is only used for the footer.
- Not on the npm registry. Install from source.

## Install

```bash
npm install     # from the repo root
npm link        # optional: puts `snap` on your PATH
```

## Quick start

```bash
# Dark theme (default), writes ./snapshot.png and copies its path to the clipboard
snap ./index.js

# Light theme, custom output, no clipboard, no git footer
snap ./index.js -t light -o index.png --clipboard none --no-footer

# Without linking
npm start -- ./index.js -o index.png
node src/snap.js ./index.js
```

On success it prints:

```text
Saved PNG: C:\path\to\snapshot.png
Copied output path to clipboard.
```

## Options

| Flag | Default | Description |
|---|---|---|
| `<filepath>` | required | Source file to render |
| `-t, --theme <dark\|light>` | `dark` | `dark` = Shiki `dracula`, `light` = `github-light` (case-insensitive) |
| `-o, --output <file>` | `snapshot.png` | Output path; must end in `.png`; relative to the current directory |
| `--clipboard <path\|none>` | `path` | `path` copies the **output file's path** (not the image) to the clipboard |
| `--no-footer` | footer on | Skip the `Last edited by <author> on <date>` line |
| `-h, --help` | | Show help |

There is no `--version` flag, config file, or environment variable. See [docs/COMMANDS.md](docs/COMMANDS.md) for details and exit codes.

## Behaviour worth knowing

- Language is chosen from the file extension (33 extensions mapped; anything else is rendered as plain text, including extension-less files such as `Dockerfile`).
- Tabs are replaced with two spaces.
- The git footer appears only if the file is inside a git repo **and** has at least one commit touching it. It shows the last *commit's* author and date, not uncommitted edits.
- Start-up takes about 4 s even for a one-line file because every Shiki grammar is loaded.
- Large inputs are slow: a 285-line, 160-column file produced a 2420×9948 px image and took about 70 s on the audit machine (Windows 11, Node 22).
- Leading spaces inside a highlighted token are not rendered correctly and the character grid is hardcoded to 14 px, so spacing can look off. See [AUDIT_REPORT.md](AUDIT_REPORT.md).

## Documentation

- [docs/COMMANDS.md](docs/COMMANDS.md): full reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it works
- [CONTRIBUTING.md](CONTRIBUTING.md): dev setup
- [AUDIT_REPORT.md](AUDIT_REPORT.md): known issues and roadmap

## License

MIT. See [LICENSE](LICENSE).
