# scripts/sync-to-wsl.sh
@source-hash: 5b6ca2f5c83b6e42
@generated: 2026-02-10T01:19:00Z

## Purpose
Bash script for syncing MCP Debugger project from Windows filesystem to WSL2 environment with optimized file transfer, dependency installation, and build automation.

## Key Components

### Configuration & Path Detection (L11-29)
- **Auto-detection logic**: Determines Windows project path by script location or command-line parameter
- **WINDOWS_PROJECT_PATH**: Source directory (Windows side)
- **WSL_PROJECT_PATH**: Target directory (`$HOME/debug-mcp-server`)
- **Fallback mechanism**: Handles execution from `/tmp` (when copied by .cmd wrapper)

### Command-line Interface (L37-64)
- **Argument parsing**: Supports `--no-install`, `--no-build`, `--clean`, `--help`
- **Flag variables**: `NO_INSTALL`, `NO_BUILD`, `CLEAN_SYNC` booleans
- **Help system**: Built-in usage documentation

### Core Sync Operations (L69-105)
- **Validation**: Checks Windows project existence (L70-73)
- **Dependency check**: Auto-installs rsync if missing (L76-79)
- **rsync transfer**: High-performance file synchronization with exclusion patterns
- **Exclusions**: Filters out `node_modules/`, `dist/`, `coverage/`, logs, temp files, and OS artifacts

### Post-sync Setup (L107-138)
- **Permission fixing**: Makes shell scripts executable (L114)
- **Dependency management**: Conditional `npm install` (L125-130)
- **Build process**: Conditional `npm run build` (L133-138)

## Architecture Patterns
- **Error handling**: `set -e` for fail-fast behavior
- **Colored output**: ANSI color codes for user feedback
- **Conditional execution**: Flag-based skipping of expensive operations
- **Performance optimization**: rsync with `--delete` for incremental syncing

## Key Dependencies
- **rsync**: Primary file synchronization tool
- **npm**: Node.js package manager for dependency/build management
- **WSL2**: Windows Subsystem for Linux execution environment

## Critical Constraints
- Must run from within WSL2 environment
- Requires Windows project to be accessible via WSL mount points
- Excludes package-lock.json from sync for performance (regenerated locally)