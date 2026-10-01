# Command reference

SnapCode exposes one executable, `snapcode` (`bin` in `package.json` → `src/snap.js`), with one command and no subcommands. Argument parsing is done by [commander](https://github.com/tj/commander.js) 15.

```text
snapcode [options] <filepath>
```

## Arguments

| Argument | Required | Notes |
|---|---|---|
| `<filepath>` | yes | Must be a regular file. Missing paths and directories exit 1 with `File not found or not a regular file: <path>`. Files containing a NUL byte exit 1 with `Binary file not supported: <path>`. Extra positionals are rejected by commander. |

## Options

| Flag | Default | Validation |
|---|---|---|
| `-t, --theme <theme>` | `dark` | `dark` or `light` (commander `choices`, case-sensitive) |
| `-o, --output <file>` | `snapshot.png` | Must end in `.png` (case-insensitive). Resolved against the current directory. Missing parent folders are created. An existing file is overwritten. |
| `--clipboard <mode>` | `none` | `image` or `none` (commander `choices`) |
| `--footer` | off | none |
| `--tab-width <n>` | `4` | Integer from 1 to 16 |
| `--max-lines <n>` | `100` | Integer from 0 to 1000000; `0` means no limit |
| `--line-numbers` | off | none |
| `--highlight <lines>` | none | Comma-separated line numbers and `a-b` ranges, 1-based, up to 1000000 (`parseLineRanges` in `src/core.js`). Lines past the end of the (clipped) file are ignored. |
| `-V, --version` | | prints `version` from `package.json` |
| `-h, --help` | | built in |

## Config

None. The code reads no config file and no environment variables. Layout values are constants in `renderSvg` (`src/core.js`):

| Constant | Value |
|---|---|
| fontSize | 24 |
| lineHeight | 34 |
| charWidth (cell width; each glyph is placed at `col × charWidth`) | 14.4 (0.6 em) |
| innerPadding | 40 |
| outerPadding | 50 |
| titleBarHeight | 44 |
| footerHeight | 34 |
| minCodeWidth | 760 |

Font stack in the SVG: `JetBrains Mono, Menlo, Consolas, monospace` (not bundled; whichever is installed is used). The font only decides glyph shape, never position: CJK, fullwidth and emoji take two cells, every other grapheme cluster one.

## Themes (`THEME_PRESETS` in `src/core.js`)

| Key | Shiki theme | Gradient | Window bg | Title text | Line numbers | Highlight |
|---|---|---|---|---|---|---|
| `dark` | `dracula` | `#3E1A70` → `#184EAB` | `#1E1F29` | `#C9D1D9` | `#6272A4` | `#44475A` |
| `light` | `github-light` | `#E8F1FF` → `#C9D9FF` | `#FFFFFF` | `#57606A` | `#8C959F` | `#FFF8C5` |

## Language detection (`detectLanguage` in `src/core.js`)

Checked in order, all lower-cased:

1. Whole file name in `FILENAME_LANG` (`cmakelists.txt`, `gemfile`, `rakefile`, `jenkinsfile`, `.bashrc`, `.zshrc`).
2. Extension in `EXT_LANG`, for extensions Shiki does not alias (`h`, `cc`, `cxx`, `hh`, `hpp`, `hxx`, `htm`, `svg`, `pl`, `pm`, `ex`, `exs`, `ml`, `mk`, `psm1`, `gradle`).
3. The extension itself (or the whole name when there is none, e.g. `dockerfile`, `makefile`), if it is a Shiki language id or alias.
4. Otherwise `text` (plain, no highlighting).

## Input handling

- File is read as UTF-8. Tabs advance to the next multiple of `--tab-width` (default 4). One trailing newline is dropped. CRLF input works.
- Control characters that XML 1.0 does not allow are removed from the rendered text.
- Empty files render a minimum-size card.
- Files longer than `--max-lines` (default 100, not counting a final newline) are cut to that many lines, and `Warning: showing the first <n> of <total> lines (change with --max-lines)` goes to stderr. The run still exits 0.

## Git footer (`--footer`)

Runs `git rev-parse --show-toplevel` in the file's directory, then `git log -1 --format=%an%x00%ad --date=short -- <relpath>`. Output is `Last edited by <author> on <YYYY-MM-DD>`. It reflects the last commit, not uncommitted edits. If git is missing, the file is outside a repo or untracked, the footer is silently omitted.

## Clipboard (`--clipboard image`)

Runs after `Saved PNG` is printed. The PNG path is passed as an argument or environment variable, never through a shell:

| Platform | Command |
|---|---|
| Windows | `powershell -STA` with `System.Windows.Forms.Clipboard::SetImage` |
| macOS | `osascript`, reading the file as `«class PNGf»` |
| Linux | `wl-copy --type image/png`, falling back to `xclip -selection clipboard -t image/png` |

Any failure prints `Warning: could not copy image to clipboard: <reason>` to stderr and the run still exits 0.

## Exit codes and output

| Code | When |
|---|---|
| 0 | PNG written (a clipboard failure is only a warning) |
| 1 | Every failure: bad option value, missing or non-regular file, binary file, commander parse errors, render/write errors |

Success messages go to stdout; errors and warnings go to stderr as a single line with no stack trace.

## Examples

```bash
snapcode src/snap.js -o out.png --clipboard none     # dark, no footer
snapcode README.md -t light -o shots/readme.png --footer
snapcode nope.js            # File not found or not a regular file: nope.js  (exit 1)
snapcode src/snap.js -t blue    # error: option '-t, --theme <theme>' argument 'blue' is invalid. Allowed choices are dark, light.  (exit 1)
snapcode src/snap.js -o out.jpg # Output file must end with .png  (exit 1)
snapcode a.js b.js          # error: too many arguments...  (exit 1)
snapcode                    # error: missing required argument 'filepath'  (exit 1)
```
