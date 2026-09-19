# mcp-debugger agent skill

This directory is a self-contained [agent skill](https://agentskills.io) that teaches AI coding agents how to debug effectively with the mcp-debugger MCP server: when to debug instead of print, the session golden path, root-cause discipline, attach/remote recipes, and per-language quirks.

The MCP server itself exposes only **tools** (plus a short `instructions` string and a `debugging-workflow` prompt as in-band pointers). The full procedural knowledge — workflow, bisection discipline, language references — lives here, where every agent harness can load it.

## Install

**Claude Code** (project- or user-level):

```bash
# user-level: available in every project
mkdir -p ~/.claude/skills && cp -r skills/debugging ~/.claude/skills/mcp-debugger

# project-level: committed with your repo
mkdir -p .claude/skills && cp -r skills/debugging .claude/skills/mcp-debugger
```

**Cross-agent directories** (GitHub Copilot CLI, and harnesses that read `~/.agents/skills/`):

```bash
mkdir -p ~/.agents/skills && cp -r skills/debugging ~/.agents/skills/mcp-debugger
mkdir -p ~/.copilot/skills && cp -r skills/debugging ~/.copilot/skills/mcp-debugger
```

**pi coding agent**: the published npm package is a pi package that ships this skill, so
`pi install npm:@debugmcp/mcp-debugger` installs it alongside the MCP server entry (from v0.25.0).

**From the npm package** (any harness that can point at a skills directory): the package ships
this directory at `node_modules/@debugmcp/mcp-debugger/skills/debugging` — no clone needed.

**Any other agent**: paste the contents of `SKILL.md` into your system prompt or rules file (e.g. `.cursorrules`, Cline custom instructions), and keep the `references/` files reachable so the agent can read the per-language guides on demand.

## Contents

- `SKILL.md` — entry point: when to debug, golden path, root-cause discipline, attach recipes, current limitations
- `references/python.md`, `javascript.md`, `ruby.md`, `rust.md`, `go.md`, `java.md`, `dotnet.md`, `cpp.md`, `cobol.md` — per-language prerequisites, quickstarts, quirks, troubleshooting

## Keeping it honest

The skill states current limitations plainly (e.g. adapter-specific `pause_execution` support, Ruby attach stdout). If you hit a behavior the skill doesn't describe, please [open an issue](https://github.com/debugmcp/mcp-debugger/issues) — the skill is maintained against real agent transcripts.
