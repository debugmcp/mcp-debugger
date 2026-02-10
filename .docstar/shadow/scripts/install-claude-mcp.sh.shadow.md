# scripts/install-claude-mcp.sh
@source-hash: 77776c03d6cc3774
@generated: 2026-02-10T00:41:58Z

## Purpose
Bash installation script that automates the setup of mcp-debugger as an MCP (Model Context Protocol) server for Claude Code IDE integration.

## Key Operations
- **Environment Setup (L7-8)**: Determines project directory structure using BASH_SOURCE path manipulation
- **Dependency Check (L14-18)**: Validates Claude CLI availability at hardcoded path `/home/ubuntu/.claude/local/claude`
- **Build Process (L21-24)**: Executes npm install and build commands to prepare the project
- **Configuration Management (L27-33)**: Removes existing mcp-debugger configuration and adds new JSON-based MCP server configuration
- **Verification (L36-65)**: Checks connection status and provides detailed user feedback with usage instructions

## Critical Dependencies
- Claude Code CLI at `/home/ubuntu/.claude/local/claude` (hardcoded path dependency)
- Node.js and npm for building the project
- Built project artifact at `$PROJECT_DIR/dist/index.js`

## Configuration Details
- **MCP Server Type**: stdio-based communication
- **Command**: `node $PROJECT_DIR/dist/index.js stdio`
- **Tool Prefix**: `mcp__mcp-debugger__` for Claude Code integration
- **Supported Languages**: Python (requires debugpy), Mock (testing)

## Architecture Pattern
Linear installation pipeline with error handling (`set -e` L5) and comprehensive user feedback. Uses Claude CLI's `mcp add-json` command for configuration injection.

## Key Constraints
- Ubuntu-specific installation path assumption
- Requires pre-installed Claude Code
- Depends on successful npm build process
- Connection verification may show false negatives if Claude Code is running during installation