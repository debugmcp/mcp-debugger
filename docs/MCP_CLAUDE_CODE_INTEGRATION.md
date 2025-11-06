# MCP Claude Code Integration - Troubleshooting Guide

## Problem Summary
The mcp-debugger server was failing to connect with Claude Code, showing "Failed to connect" status even though the server was properly built and functional.

## Root Cause Analysis

### The Issue
The MCP (Model Context Protocol) uses JSON-RPC over STDIO for communication between Claude Code and MCP servers. The mcp-debugger server was outputting debug logs to stdout, which corrupted the JSON-RPC protocol communication.

### Why It Failed
1. **Protocol Corruption**: Any text written to stdout that isn't valid JSON-RPC breaks the protocol
2. **Default Logging**: The server's Winston logger was configured to output to console by default
3. **Missing Argument**: The server had code to suppress console output when "stdio" argument was passed, but Claude Code wasn't passing this argument

### Discovery Process
1. **Initial Test**: Running `claude mcp list` showed the server as "Failed to connect"
2. **Manual Testing**: Direct execution (`node dist/index.js`) worked but included log output
3. **Protocol Testing**: Sending JSON-RPC messages manually revealed mixed log and JSON output
4. **Argument Testing**: Adding "stdio" argument produced clean JSON output

## Solution Implementation

### Step 1: Immediate Fix (Configuration)
The immediate fix was to configure Claude Code to pass the "stdio" argument:

```bash
# Remove existing configuration
/home/ubuntu/.claude/local/claude mcp remove mcp-debugger

# Add with proper JSON configuration including stdio argument
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"node","args":["/home/ubuntu/mcp-debugger/dist/index.js","stdio"],"env":{}}'
```

### Step 2: Code Improvement (Auto-detection)
Enhanced the server to auto-detect STDIO mode without requiring explicit argument:

```typescript
// src/index.ts - Auto-detection logic
const hasTransportArg = process.argv.some(arg =>
  arg === '--transport' || arg.includes('transport')
);
const isStdinPipe = !process.stdin.isTTY;
const shouldSilenceConsole = hasStdio ||
                             process.env.CONSOLE_OUTPUT_SILENCED === '1' ||
                             (!hasTransportArg && isStdinPipe);
```

This detects STDIO mode by checking:
1. Explicit "stdio" argument (most reliable)
2. Environment variable `CONSOLE_OUTPUT_SILENCED=1`
3. No transport argument + stdin is a pipe (typical for MCP STDIO)

### Step 3: Documentation Updates
Updated CLAUDE.md with:
- Correct installation command using `add-json`
- Explanation of why stdio argument is critical
- Troubleshooting steps for connection issues
- Manual testing commands

## Testing Verification

### Manual Protocol Test
```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{},"sampling":{}},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node dist/index.js stdio
```
Should return clean JSON without any log messages.

### Connection Verification
```bash
/home/ubuntu/.claude/local/claude mcp list
# Should show: mcp-debugger: node /home/ubuntu/mcp-debugger/dist/index.js stdio - ✓ Connected
```

### Functional Test
Successfully tested with Python debugging:
- Created debug session
- Set breakpoints
- Started debugging
- Inspected variables
- Stepped through code
- Closed session cleanly

## Lessons Learned

1. **STDIO Protocol Sensitivity**: MCP STDIO mode requires absolutely clean stdout - no logs, warnings, or debug output
2. **Default Behavior Matters**: Servers should default to safe behavior when stdin is piped
3. **Documentation Critical**: Installation instructions must be precise about required arguments
4. **Testing Important**: Always test the actual integration, not just the server in isolation

## Installation Methods for Different Use Cases

### Method 1: NPX (Recommended for Testing)
**Best for**: Trying out mcp-debugger without installation
```bash
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"npx","args":["@debugmcp/mcp-debugger","stdio"]}'
```
- ✅ No installation required
- ✅ Always uses latest published version
- ✅ Minimal system footprint
- ❌ Slower startup (downloads on first run)

### Method 2: Global NPM Install (Recommended for Regular Use)
**Best for**: Frequent debugging across multiple projects
```bash
# Install globally
npm install -g @debugmcp/mcp-debugger

# Configure Claude Code
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"mcp-debugger","args":["stdio"]}'
```
- ✅ Fast startup
- ✅ Works offline after installation
- ✅ Standard Node.js tooling
- ❌ Requires Node.js/npm on system

### Method 3: Docker (Recommended for Isolation)
**Best for**: Complete isolation and consistency
```bash
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"docker","args":["run","-i","--rm","-v","${PWD}:/workspace","debugmcp/mcp-debugger:latest","stdio"]}'
```
- ✅ Complete isolation
- ✅ No Node.js required on host
- ✅ Consistent environment
- ❌ Requires Docker
- ❌ Larger footprint

### Method 4: Build from Source (For Development)
**Best for**: Developing mcp-debugger itself
```bash
# Clone and build
git clone https://github.com/debugmcp/mcp-debugger.git
cd mcp-debugger
npm install
npm run build

# Use installation script
./scripts/install-claude-mcp.sh

# Or manually configure
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"node","args":["/absolute/path/to/mcp-debugger/dist/index.js","stdio"]}'
```
- ✅ Latest development features
- ✅ Can modify and test changes
- ❌ Requires rebuilding after changes
- ❌ Must restart Claude Code to test changes

### Important Notes for All Methods

1. **The `stdio` argument is required** (until v0.15.0+ with auto-detection is published)
2. **Restart Claude Code** after adding/changing MCP configuration
3. **Verify connection** with: `/home/ubuntu/.claude/local/claude mcp list`
4. **Python debugging** requires: `pip install debugpy`

## Recommendations for Automation

### 1. Installation Script
Create an installation script that handles the configuration automatically:

```bash
#!/bin/bash
# install-mcp-server.sh
npm install
npm run build
/home/ubuntu/.claude/local/claude mcp add-json mcp-debugger \
  '{"type":"stdio","command":"node","args":["'$(pwd)'/dist/index.js","stdio"],"env":{}}'
```

### 2. Server Entry Point Enhancement
Consider creating a dedicated MCP entry point that always suppresses console:

```javascript
// mcp-entry.js
process.env.CONSOLE_OUTPUT_SILENCED = '1';
require('./dist/index.js');
```

### 3. Build-time Configuration
Add a build step that creates an MCP-specific bundle with logging disabled by default.

### 4. Health Check Tool
Create a tool to verify MCP compatibility:

```bash
npm run test:mcp-integration
```

## Common Pitfalls to Avoid

1. **Don't use console.log** in MCP servers unless explicitly checking for STDIO mode
2. **Don't assume** Claude Code will pass specific arguments
3. **Always test** with actual MCP protocol messages, not just server startup
4. **Remember** that Winston logger outputs to console by default
5. **Check for** environment differences between development and MCP runtime

## Quick Reference

### Working Configuration
```json
{
  "type": "stdio",
  "command": "node",
  "args": ["/home/ubuntu/mcp-debugger/dist/index.js", "stdio"],
  "env": {}
}
```

### Required Package.json Scripts
```json
{
  "scripts": {
    "build": "npm run build:packages && npm run build:servercore",
    "build:packages": "tsc -b packages",
    "build:servercore": "tsc -p tsconfig.json"
  }
}
```

### Environment Variables
- `CONSOLE_OUTPUT_SILENCED=1` - Forces console suppression
- `MCP_CONTAINER=true` - Indicates running in container mode

## Related Files
- `/home/ubuntu/mcp-debugger/CLAUDE.md` - User-facing documentation
- `/home/ubuntu/mcp-debugger/src/index.ts` - Entry point with STDIO detection
- `/home/ubuntu/.claude.json` - Claude Code configuration file
