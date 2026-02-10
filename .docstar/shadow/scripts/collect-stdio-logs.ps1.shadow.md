# scripts/collect-stdio-logs.ps1
@source-hash: bbd84a81d61aee27
@generated: 2026-02-10T00:41:59Z

**Purpose**: PowerShell script for collecting MCP debugger diagnostic output by running CLI commands in a Docker container and capturing stdio/logging to host filesystem for analysis.

**Core Functionality**:
- **Directory Setup (L5-8)**: Creates `logs/diag-stdio` directory in current project location for output collection
- **Docker Volume Binding (L10-11)**: Maps host output directory to container `/app/logs` path for log extraction
- **Container Execution (L14)**: Single complex Docker command that:
  - Clears existing logs in container
  - Runs `node dist/index.js --help` capturing output to `cli-help.txt`
  - Runs `node dist/index.js stdio` in background capturing to `cli-stdio.txt`
  - Sleeps 3 seconds to allow stdio command to generate output
  - Lists container logs directory contents
  - Kills background stdio process
- **Log Display (L16-33)**: Outputs collected diagnostic files with different formatting:
  - Full directory listing (L17)
  - Complete cli-help.txt content (L19-21)
  - First 200 lines of cli-stdio.txt (L23-25)
  - Complete bundle-start.log content (L27-29)
  - Last 200 lines of debug-mcp-server.log (L31-33)

**Key Dependencies**:
- Docker with `mcp-debugger:local` image
- PowerShell environment
- Node.js application with CLI interface at `dist/index.js`

**Architecture Pattern**: Diagnostic collection script using Docker for isolated execution and volume mounting for log extraction. Uses defensive programming with file existence checks and error handling via `|| true` for non-critical failures.

**Critical Constraints**:
- Requires `mcp-debugger:local` Docker image to exist
- Assumes Node.js app structure with `dist/index.js` entry point
- 3-second timeout for stdio command execution may be insufficient for slow operations