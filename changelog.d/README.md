# Changelog fragments

Each PR that changes anything user-visible drops **one new file** in this directory instead of
editing `CHANGELOG.md`. At release time the fragments are folded into `CHANGELOG.md` and deleted.

## Why

Every PR used to prepend its entry to the same line under `### Fixed` in `CHANGELOG.md`. Two PRs
open at once therefore edited the *same line* and the second to merge always conflicted, no matter
how unrelated the actual changes were. Fragments give each PR its own path, so the conflict cannot
happen (issue #546).

It also closes the other half of the problem: #462 found `[Unreleased]` carrying two separate
`### Fixed` blocks and ~15 merged changes missing entirely, because catching up by hand at release
time is where gaps hide.

## Naming

```
<issue-number>[-<slug>].<category>.md
```

- **`<issue-number>`** — the issue or PR number. This is what guarantees uniqueness, so it is
  required.
- **`<slug>`** — optional, only needed when one issue needs two entries in different categories
  (`546-collation.fixed.md`).
- **`<category>`** — one of `added`, `changed`, `deprecated`, `removed`, `fixed`, `security`.

Examples: `546.added.md`, `533-sse-logging.fixed.md`.

## Contents

The entry text **exactly as it should appear in `CHANGELOG.md`**, minus the leading `- `. Keep the
house style: a bolded lede naming the user-visible change, then the explanation, then the issue
reference.

```markdown
**Windows accepts an extensionless Ruby script in `RDBG_PATH`** — when `RDBG_PATH` resolved
directly to the gem-installed `rdbg` script instead of its `.bat`/`.cmd` shim, Node.js tried to
spawn the extensionless file and failed with `ENOENT`; mcp-debugger now launches that script
through the configured Ruby interpreter (#508)
```

Write the issue reference yourself — it is not derived from the filename, because entries that fix
two issues cite both, e.g. `(#533, #534)`.

## Commands

```bash
pnpm changelog:check      # validate pending fragment names and bodies
pnpm changelog:collate    # fold fragments into CHANGELOG.md, then delete them (release step)
```

## CI

A PR touching `src/`, `packages/`, or `tools/` must add a fragment. Test-only changes are exempt
automatically. If a PR genuinely needs no entry — a pure refactor, a CI-internal change — apply the
`no-changelog` label.
