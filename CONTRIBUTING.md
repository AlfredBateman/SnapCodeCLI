# Contributing

## Setup

```bash
node --version      # 22.12+ required
npm install
node src/snap.js --help
```

Run it against a file and look at the PNG:

```bash
npm start -- src/snap.js -o out.png --clipboard none
```

Use `--clipboard none` while developing so you do not overwrite your clipboard. It is the default, but pass it explicitly in scripts.

## Tests

```bash
npm test            # node --test, runs test/*.test.js
npm run dev         # web UI server, restarts when src/ changes
```

`test/core.test.js` checks the pure renderer (`src/core.js`): whitespace, trailing newline, tabs, clipping, line numbers, highlighting, no SVG filter, XML escaping, language detection. `test/server.test.js` starts the web UI server on a free port and checks the page, a render, and every rejected request. `test/cli.test.js` runs `src/snap.js` and checks every exit code and error message. CI (`.github/workflows/ci.yml`) runs `npm test` on Windows, macOS and Linux with Node 20 and 22. There is no linter.

Also check the CLI by hand:

```bash
node src/snap.js src/snap.js -o out.png --clipboard none   # happy path
node src/snap.js nope.js            # expect exit 1, "File not found or not a regular file"
node src/snap.js src                # expect exit 1, same message (directory)
node src/snap.js x.js -t blue       # expect exit 1, "Allowed choices are dark, light"
node src/snap.js x.js -o x.jpg      # expect exit 1, "must end with .png for --format png"
```

Look at the image, not just the exit code: spacing (e.g. `import fs from`), tab handling, wide characters, and that the footer appears with `--footer` inside a git repo.

For the web UI, run `node src/snap.js serve --no-open` and open http://127.0.0.1:3333. The page is read once at startup, so restart the server after editing `src/index.html`. UI changes follow [DESIGN.md](DESIGN.md); check the empty, rendering, ready, error and clipped states at desktop and phone widths, and that everything works from the keyboard.

## Style (no config enforces it)

- ES modules, `node:` prefix for built-ins.
- 2-space indent, double quotes, semicolons, trailing commas in multi-line literals.
- `function` declarations for helpers; each command is an `async function` passed to commander's `.action()`.
- User-facing errors: `console.error("<message>")` then `process.exit(1)`.
- `src/core.js` must stay free of Node built-ins, sharp and the filesystem, so it can also run in a browser.

## Common changes

**Add an option.** Add `.option(...)` or `.addOption(new Option(...).choices([...]))` in the chain in `src/snap.js`. If it changes the image, pass it through to `renderSvg` in `src/core.js`. Document it in `README.md` and `docs/COMMANDS.md`.

**Add a theme.** Add an entry to `THEME_PRESETS` in `src/core.js` (including `lineNumber` and `highlight` colours). That is all; the CLI choices, the web UI toggle and Shiki loading follow from it.

**Add a language/extension.** Usually unnecessary: any Shiki language id or alias already works. Otherwise add to `EXT_LANG` or `FILENAME_LANG` in `src/core.js`.

## Before opening a PR

- Run `npm test` and the manual checks above on your platform.
- Run `npm audit` and mention any new findings.
- If you touch `package.json`, check `npm pack --dry-run` (only `src`, README and LICENSE should ship).
