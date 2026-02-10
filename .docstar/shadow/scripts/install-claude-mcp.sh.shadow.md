# scripts/install-claude-mcp.sh
@source-hash: 77776c03d6cc3774
@generated: 2026-02-09T18:15:14Z

## Purpose
Installation script for integrating mcp-debugger as an MCP (Model Context Protocol) server with Claude Code. Automates the complete setup process including building, configuration, and verification.

## Key Operations

**Environment Setup (L7-8)**
- Determines script and project directories using BASH_SOURCE resolution
- Sets up path references for subsequent operations

**Prerequisite Validation (L14-18)**
- Validates Claude CLI availability at hardcoded path `/home/ubuntu/.claude/local/claude`
- Exits with error if Claude Code installation not detected

**Project Build Process (L21-24)**
- Executes `npm install` and `npm run build` in project directory
- Builds TypeScript project to `dist/` output directory

**MCP Server Configuration (L27-33)**
- Removes existing mcp-debugger configuration to prevent conflicts (L28)
- Registers new MCP server using `claude mcp add-json` command (L32-33)
- Configures stdio-based communication with Node.js runtime pointing to built `dist/index.js`

**Installation Verification (L36-65)**
- Tests MCP server connection using `claude mcp list` grep pattern matching (L38)
- Provides comprehensive success messaging with usage instructions (L39-54)
- Includes fallback messaging for connection issues with troubleshooting guidance (L56-64)

## Dependencies
- **External**: Claude Code CLI, Node.js runtime, npm package manager
- **Internal**: Project build system producing `dist/index.js`, CLAUDE.md documentation

## Architectural Decisions
- **Hardcoded Paths**: Uses fixed Ubuntu user path `/home/ubuntu/.claude/local/claude` limiting portability
- **Error Handling**: Uses `set -e` for fail-fast behavior with selective error suppression (L28)
- **JSON Configuration**: Embeds MCP server config as inline JSON string rather than external file

## Critical Constraints
- **Platform Specific**: Ubuntu-only due to hardcoded user directory paths
- **Build Dependency**: Requires successful npm build producing `dist/index.js` before MCP registration
- **Claude Code Integration**: Assumes specific Claude CLI command structure and MCP protocol implementation