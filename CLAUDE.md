# CLAUDE.md

Standing rules for this repo.

- I am the sole author. Never add `Co-Authored-By` trailers or "Generated with" lines to commits or PRs. Attribution is also disabled in `.claude/settings.json`.
- Small commits, conventional messages (`fix:`, `feat:`, `docs:`, `chore:`), one logical change each.
- Apply ponytail principles: simplest solution, no speculative abstractions, stdlib before dependencies.
- Always use `--clipboard none` when testing. Never touch global state (no global installs, no global git config).
- UI work follows [DESIGN.md](DESIGN.md) in the repo root.
