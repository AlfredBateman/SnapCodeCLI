# Contributing

## Setup

```bash
node --version      # 18.17+ required (sharp); audit ran on 22
npm install
node src/snap.js --help
```

Run it against a file and look at the PNG:

```bash
npm start -- src/snap.js -o out.png --clipboard none
```

Use `--clipboard none` while developing so you do not overwrite your clipboard (and so a missing clipboard backend does not fail the run).

## Tests

**There are none.** `package.json` has only `start` and `snap` scripts, `npm test` fails with `Missing script: "test"`, and there is no linter, formatter config or CI. Until that changes, verify manually:

```bash
node src/snap.js src/snap.js -o out.png --clipboard none   # happy path (slow, see AUDIT_REPORT F-01; use a small file for quick checks)
node src/snap.js nope.js            # expect exit 1, "File not found"
node src/snap.js x.js -t blue       # expect exit 1, "Invalid theme"
node src/snap.js x.js -o x.jpg      # expect exit 1, "must end with .png"
```

Check the image by eye for: leading spaces in tokens (e.g. `import fs`), tab handling, wide characters, and that the footer appears in a git repo and disappears with `--no-footer`.

When adding tests, the first thing to do is split `run()` (`src/snap.js:114-279`) so layout/SVG building is a pure function you can call without sharp or the filesystem.

## Style (inferred from `src/snap.js`; no config enforces it)

- ES modules, `node:` prefix for built-ins.
- 2-space indent, double quotes, semicolons, trailing commas in multi-line literals.
- `function` declarations for helpers, `async function run()` for the main flow.
- User-facing errors: `console.error("<message>")` then `process.exit(1)`.

## Common changes

**Add an option.** Add `.option(...)` in the chain at `snap.js:115-130`, validate it next to the other checks (`snap.js:140-160`), then use it in `run()`. Document it in `README.md` and `docs/COMMANDS.md`. Prefer commander's `.choices()` or `.addOption(new Option(...).choices([...]))` over hand-written validation.

**Add a theme.** Add an entry to `THEME_PRESETS` (`snap.js:49-64`) **and** add its Shiki theme name to the `themes` array in `createHighlighter` (`snap.js:168`); the CLI's `--theme` validation reads `THEME_PRESETS` keys, but the highlighter will throw if the theme was never loaded. The error message at `snap.js:147` is hardcoded and needs updating too.

**Add a language/extension.** Add to `EXT_TO_LANG` (`snap.js:13-47`) using a Shiki language id (see `bundledLanguages` in shiki).

**Add a subcommand.** Not supported today: the program is a single default command with a required `<filepath>` argument and all logic in `run()`. A subcommand would need `run()` split first.

## Before opening a PR

- Run the manual checks above on your platform (note: audit only exercised Windows 11).
- Run `npm audit` and mention any new findings.
- If you touch `package.json`, check `npm pack --dry-run`: the tarball currently includes stray PNGs.
