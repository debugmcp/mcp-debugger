# Using Multiple MCP Servers Together

This guide explains how to use the Debug MCP Server alongside the GitHub MCP Server, giving you both debugging capabilities and GitHub integration in your LLM workflows.

## Configuration

Both servers can be configured in the same MCP settings file. The configuration below shows how to set up both servers:

```json
{
  "mcpServers": {
    "mcp-debugger": {
      "command": "npx",
      "args": ["-y", "@debugmcp/mcp-debugger", "stdio"],
      "disabled": false,
      "autoApprove": ["create_debug_session", "set_breakpoint", "get_variables"]
    },
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

`stdio` is mcp-debugger's default subcommand, so passing it explicitly is optional — but
spell it out anyway: it is the command that silences console output, and being explicit
keeps the config readable when someone later adds `--log-level` or `--log-file`. The other
subcommands are `sse` (deprecated), `http`, `doctor`, and `check-rust-binary`.

Substitute your preferred install for the `command`/`args` pair — `mcp-debugger stdio` after
a global npm install, or `node C:/path/to/mcp-debugger/dist/index.js stdio` from a source
checkout. See [the root README](../README.md#-quick-start) for the per-client variants
(Claude Desktop, Codex CLI, Claude Code).

To run mcp-debugger itself in Docker alongside the GitHub server, mount your workspace and
keep **both** `-i` and `--rm`:

```json
{
  "command": "docker",
  "args": ["run", "-i", "--rm", "-v", "${PWD}:/workspace", "debugmcp/mcp-debugger:latest", "stdio"]
}
```

`-i` matters. Since issue #633 the container exits when its MCP client disconnects, so
`--rm` fires and the container is cleaned up. That teardown is keyed on stdin: without `-i`
there is no stdin for a client to speak on, the server takes the deliberate
detached-container branch and stays alive, and nothing ever reaps it.

## Prerequisites

1. **For Debug MCP Server**:
   - Node.js 22 or higher
   - Whatever toolchain each language you debug needs — Python + debugpy, Ruby + the
     `debug` gem, Node.js, Go + Delve, JDK 21+, the .NET SDK, the Rust toolchain, or a
     C/C++ compiler. `mcp-debugger doctor` reports what it can find.

2. **For GitHub MCP Server**:
   - Docker installed and running
   - GitHub Personal Access Token with appropriate permissions

## Testing Both Servers

Check each server on its own before wiring both into a client.

1. **Debug MCP Server** — the `doctor` subcommand reports every adapter's toolchain and
   backend, and exits non-zero for any language you name that is not usable:

   ```bash
   npx @debugmcp/mcp-debugger doctor          # report everything, always exit 0
   npx @debugmcp/mcp-debugger doctor python   # gate the exit code on Python only
   ```

   To confirm the stdio transport itself is clean, drive one `initialize` by hand — the
   reply must be JSON and nothing else:

   ```bash
   echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{},"sampling":{}},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | npx @debugmcp/mcp-debugger stdio
   ```

   Any log line mixed into that output is what breaks the client connection.

2. **GitHub MCP Server**: confirm Docker is running and the image pulls —
   `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server`
   should sit waiting on stdin rather than exiting with an error.

## Using Servers with Claude

Once both entries are in your MCP settings, restart the client and verify:

1. Claude Code: `claude mcp list` should show both as connected; `/mcp` lists them in
   session. Codex: `codex mcp list`. Desktop clients show them in their MCP/settings panel.
2. Both should report as connected, not "Failed to connect"
3. You can then use tools from either server in the same conversation

## Example Workflows

### Debugging a GitHub Repository

1. Read the file with the GitHub server's `get_file_contents` tool:

   ```json
   get_file_contents {"owner": "username", "repo": "repository", "path": "path/to/file.py"}
   ```

2. Debug it with mcp-debugger. Note that mcp-debugger runs on **your** machine and needs
   the source on a local path — clone or write the file out first, then point the session
   at it:

   ```json
   create_debug_session {"language": "python", "name": "GitHub Code Debug"}
   set_breakpoint       {"sessionId": "<id>", "file": "/abs/path/to/file.py", "line": 42}
   start_debugging      {"sessionId": "<id>", "scriptPath": "/abs/path/to/file.py"}
   get_local_variables  {"sessionId": "<id>"}
   close_debug_session  {"sessionId": "<id>"}
   ```

## Troubleshooting

### Debug MCP Server Issues
- See [troubleshooting.md](./troubleshooting.md) for debug server specific issues

### GitHub MCP Server Issues
- Verify Docker is running
- Check that your GitHub token has the required permissions
- Ensure the token is correctly set in the MCP settings

### General Issues
- If two servers expose a similarly named tool, disambiguate by the server the client
  attributes it to — mcp-debugger registers under the key `mcp-debugger`
- Restart the client after editing the MCP settings file; most read it only at startup
