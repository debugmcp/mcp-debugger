# mcp_debugger_launcher\pyproject.toml
@source-hash: 0ffa4d22f90cb4e6
@generated: 2026-02-24T01:54:03Z

Python project configuration file defining package metadata and build requirements for a debug MCP server launcher.

**Core Configuration:**
- Package name: `debug-mcp-server-launcher` (L2)  
- Version: 0.17.0 (L3)
- Purpose: Ensures debugpy installation and provides instructions for running Node.js/Docker MCP servers (L4)
- Python compatibility: >=3.8 through 3.11 (L6, L16-19)

**Dependencies:**
- Core runtime deps: debugpy>=1.8.14, click>=8.0.0 (L23-26)
- Build system: setuptools>=61.0, wheel (L35-37)

**Entry Points:**
- CLI command: `debug-mcp-server` → `mcp_debugger_launcher.cli:main` (L33)

**Package Structure:**
- Single package: `mcp_debugger_launcher` (L40)
- Includes LICENSE file in package data (L42-43)

**Project Metadata:**
- MIT license targeting developers (L7, L14)
- Keywords focus on MCP, DAP debugging, AI agents (L11)
- Repository: github.com/debugmcp/mcp-debugger (L29-30)
- Development status: Alpha (L13)

**Build Backend:**
Uses setuptools build system with standard configuration (L35-37). Package is designed as a launcher/wrapper that bridges Python debugging tools with external MCP server implementations.