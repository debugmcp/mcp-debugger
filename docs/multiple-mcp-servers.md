# Using Multiple MCP Servers Together

This guide explains how to use the Debug MCP Server alongside the GitHub MCP Server, giving you both debugging capabilities and GitHub integration in your LLM workflows.

## Configuration

Both servers can be configured in the same MCP settings file. The configuration below shows how to set up both servers:

```json
{
  "mcpServers": {
    "debug-mcp-server": {
      "autoApprove": [],
      "disabled": false,
      "timeout": 60,
      "command": "c:/path/to/debug-mcp-server/simple-run.cmd",
      "transportType": "stdio"
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
      "autoApprove": [],
      "timeout": 60
    }
  }
}
```

## Prerequisites

1. **For Debug MCP Server**:
   - Node.js 16.0.0 or higher
   - Python 3.7 or higher (for Python debugging)

2. **For GitHub MCP Server**:
   - Docker installed and running
   - GitHub Personal Access Token with appropriate permissions

## Testing Both Servers

You can test each server individually using the provided test scripts:

1. **Debug MCP Server**:
   ```
   .\test-server.cmd
   ```

2. **GitHub MCP Server**:
   ```
   .\test-github-mcp.cmd
   ```

## Using Servers with Claude

When using both servers with Claude in VS Code:

1. Both servers should appear in the Claude sidebar under "MCP Servers"
2. Both should show as "Connected" if they're running correctly
3. You can use tools from either server in the same conversation

## Example Workflows

### Debugging a GitHub Repository

1. Clone a repository using GitHub MCP Server:
   ```
   use_mcp_tool(
     server_name="github",
     tool_name="get_file_contents",
     arguments={
       "owner": "username",
       "repo": "repository",
       "path": "path/to/file.py"
     }
   )
   ```

2. Debug the code using Debug MCP Server:
   ```
   use_mcp_tool(
     server_name="debug-mcp-server",
     tool_name="create_debug_session",
     arguments={
       "language": "python",
       "name": "GitHub Code Debug"
     }
   )
   ```

## Troubleshooting

### Debug MCP Server Issues
- See [troubleshooting.md](./troubleshooting.md) for debug server specific issues

### GitHub MCP Server Issues
- Verify Docker is running
- Check that your GitHub token has the required permissions
- Ensure the token is correctly set in the MCP settings

### General Issues
- Only one server can be used at a time in each prompt
- Make sure to specify the correct `server_name` in your `use_mcp_tool` calls
- Restart VS Code if the servers show as disconnected
