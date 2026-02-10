# scripts/prepare-pack.js
@source-hash: de2acac12e08929d
@generated: 2026-02-10T00:42:02Z

## Purpose
Build automation script that resolves `workspace:*` dependencies to concrete versions for package publishing. Prepares packages for packing by mimicking pnpm's automatic dependency resolution behavior during publish.

## Core Components

**Entry Point & Setup (L1-16)**
- Executable Node.js script with shebang
- ES module imports for file system operations and URL handling
- Path constants for target package: `mcp-debugger` in packages directory
- Backup file management for safe operations

**Logging Utilities (L18-24)**
- `log()`: Standard info messages with `[prepare-pack]` prefix
- `warn()`: Warning messages for error conditions

**Workspace Version Resolution (L27-43)**
- `getWorkspaceVersions()`: Scans hardcoded workspace list for package versions
- Reads `package.json` from each workspace: `shared`, `adapter-javascript`, `adapter-python`, `adapter-mock`, `adapter-rust`
- Returns name->version mapping for dependency resolution

**Dependency Resolution Engine (L46-85)**
- `resolveWorkspaceDeps(pkg, versions)`: Core transformation logic
- `resolveDeps()` helper (L50-68): Processes dependency objects, converts `workspace:*` references to concrete versions
- Handles all dependency types: `dependencies`, `devDependencies`, `peerDependencies`
- Logs each transformation for transparency

**Command Interface (L87-136)**
- `main()`: CLI handler with two commands:
  - `prepare`: Backs up original, resolves workspace deps, writes transformed package.json
  - `restore`: Reverts to backup if available
- Safety mechanism: automatically restores existing backup before prepare operations
- Error handling with proper exit codes

## Key Architectural Decisions
- **Hardcoded workspace list**: Explicit package enumeration instead of dynamic discovery
- **Backup strategy**: Creates `.backup` files to enable safe rollback operations  
- **In-place modification**: Directly modifies target package.json rather than creating separate output
- **Synchronous operations**: Uses sync file I/O for simplicity in build context

## Dependencies
- Node.js built-in modules: `fs`, `path`, `url`
- Target workspace structure with packages directory containing specific adapters

## Critical Constraints
- Only processes `mcp-debugger` package (hardcoded path)
- Requires specific workspace structure and naming conventions
- Fails fast if workspace dependencies cannot be resolved
- Backup files must be manually cleaned up on script failure