# Command reference

SnapCode exposes one executable, `snap` (`package.json:6-8` → `src/snap.js`), with one command and no subcommands. Argument parsing is done by [commander](https://github.com/tj/commander.js) 12 in `src/snap.js:115-130`.

```text
snap [options] <filepath>
```

## Arguments

| Argument | Required | Notes |
|---|---|---|
| `<filepath>` | yes | Path to a file. Checked with `fs.existsSync` (`snap.js:140`). Directories pass that check and then fail at read with a raw `EISDIR` error. Only the first positional is used; extras are ignored. |

## Options

| Flag | Default | Validation | Source |
|---|---|---|---|
| `-t, --theme <theme>` | `dark` | Lower-cased, must be `dark` or `light`, otherwise exit 1 | `snap.js:119, 145-149` |
| `-o, --output <file>` | `snapshot.png` | Must end in `.png` (case-insensitive). Resolved against `process.cwd()`. Parent directory must already exist. Existing file is overwritten silently. | `snap.js:120, 151-154, 264-265` |
| `--clipboard <mode>` | `path` | Lower-cased, must be `path` or `none`, otherwise exit 1 | `snap.js:121-125, 156-160` |
| `--no-footer` | footer enabled | none | `snap.js:126-129, 202` |
| `-h, --help` | | built in | commander |

`--version` is **not** defined; `snap --version` exits 1 with `error: unknown option '--version'`.

The `--help` text prints the clipboard default twice (`(default: path) (default: "path")`) because the default is written into both the description and the option definition (`snap.js:123-124`).

## Config

None. The code reads no config file and no environment variables. All layout values are constants in `snap.js:186-193`:

| Constant | Value |
|---|---|
| fontSize | 24 |
| lineHeight | 34 |
| charWidth (assumed glyph advance) | 14 |
| innerPadding | 40 |
| outerPadding | 50 |
| titleBarHeight | 44 |
| footerHeight | 34 |
| minCodeWidth | 760 |

Font stack in the SVG: `JetBrains Mono, Menlo, Consolas, monospace` (not bundled; whichever is installed is used).

## Themes (`snap.js:49-64`)

| Key | Shiki theme | Gradient | Window bg | Title text |
|---|---|---|---|---|
| `dark` | `dracula` | `#3E1A70` → `#184EAB` | `#1E1F29` | `#C9D1D9` |
| `light` | `github-light` | `#E8F1FF` → `#C9D9FF` | `#FFFFFF` | `#57606A` |

## Language detection (`snap.js:13-47, 75-78`)

Lower-cased extension lookup only; unknown extensions and files without one use `plaintext`.

`.js .cjs .mjs`→javascript · `.ts`→typescript · `.tsx`→tsx · `.jsx`→jsx · `.py`→python · `.java` · `.rb`→ruby · `.php` · `.go` · `.rs`→rust · `.cpp .cc .cxx`→cpp · `.c` · `.cs`→csharp · `.swift` · `.kt .kts`→kotlin · `.scala` · `.sh .zsh`→bash · `.json` · `.yml .yaml`→yaml · `.md`→markdown · `.html` · `.css` · `.scss` · `.sql` · `.xml` · `.toml`

## Input handling

- File is read as UTF-8 (`snap.js:162`). Every tab becomes two spaces. CRLF input works.
- Binary or NUL-containing input fails with `Input buffer has corrupt header: glib: XML parse error ... PCDATA invalid Char value 0` (observed).
- Empty files render a minimum-size card.

## Git footer (`snap.js:80-112`)

Runs `git rev-parse --show-toplevel` in the file's directory, then `git log -1 --format=%an|%ad --date=short -- <relpath>`. Output is `Last edited by <author> on <YYYY-MM-DD>`. Any failure, no repo, untracked file, or an author name containing `|`, silently omits the footer.

## Clipboard (`snap.js:271-273`)

`--clipboard path` calls `clipboardy.write(outputPath)` after the PNG is written. It copies the path text, not the image. A clipboard failure is not caught locally; it reaches the top-level handler and exits 1 even though the PNG was saved.

## Exit codes and output

| Code | When |
|---|---|
| 0 | PNG written (and clipboard write succeeded, if requested) |
| 1 | Every failure: bad option value, missing file, commander parse errors, read errors, render/write errors (`snap.js:142, 148, 153, 159, 283`) |

Success messages go to stdout; errors go to stderr as a single line with no stack trace.

## Examples (all executed during the audit)

```bash
snap src/snap.js -o out.png --clipboard none     # dark, default footer
snap README.md -t LIGHT -o readme.png --clipboard none
snap nope.js            # File not found: nope.js          (exit 1)
snap src/snap.js -t blue    # Invalid theme. Use --theme dark or --theme light. (exit 1)
snap src/snap.js -o out.jpg # Output file must end with .png (exit 1)
snap                    # error: missing required argument 'filepath' (exit 1)
```
