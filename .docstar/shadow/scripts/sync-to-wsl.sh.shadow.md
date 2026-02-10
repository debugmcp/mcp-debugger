# scripts/sync-to-wsl.sh
@source-hash: f6a0cd66c133a088
@generated: 2026-02-09T18:15:16Z

## Purpose and Responsibility
Bash script that syncs an MCP Debugger project from Windows filesystem to WSL2 environment, handling cross-platform file system differences and automating the development workflow setup.

## Key Components

### Configuration and Path Detection (L11-30)
- **Auto-detection logic (L13-28)**: Determines Windows project path by script location or falls back to user-provided path parameter
- **WSL_PROJECT_PATH (L29)**: Fixed destination at `$HOME/debug-mcp-server`

### Command Line Interface (L37-64)
- **Argument parsing loop (L42-64)**: Processes `--no-install`, `--no-build`, `--clean`, and `--help` flags
- **Boolean flags (L38-40)**: Control script behavior for installation, building, and clean sync operations

### Core Sync Operations (L69-105)
- **Path validation (L70-73)**: Ensures Windows source directory exists
- **rsync installation check (L75-79)**: Auto-installs rsync if missing
- **Clean sync option (L81-85)**: Removes destination directory when `--clean` flag used
- **rsync command (L92-105)**: Excludes build artifacts, logs, and platform-specific files while syncing

### Post-Sync Setup (L107-138)
- **Permission fixing (L111-114)**: Makes shell scripts executable (Windows permissions don't transfer)
- **Dependency management (L116-130)**: Handles missing package-lock.json and runs npm install
- **Build process (L132-138)**: Executes npm run build unless skipped

## Dependencies
- **rsync**: For efficient file synchronization
- **npm**: For dependency installation and building
- **sudo/apt-get**: For installing missing packages

## Notable Patterns
- **Defensive programming**: Extensive error checking and graceful fallbacks
- **Performance optimization**: Uses rsync with exclusions for faster syncing
- **Cross-platform compatibility**: Handles Windows-WSL file system mounting differences
- **User experience**: Color-coded output and helpful usage messages

## Critical Constraints
- Must be run from within WSL2 environment
- Assumes standard WSL mount paths (`/mnt/c/...`)
- Requires sudo privileges for package installation
- Excludes sensitive files like `package-lock.json` for sync speed