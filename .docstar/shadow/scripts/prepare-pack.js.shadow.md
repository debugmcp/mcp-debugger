# scripts/prepare-pack.js
@source-hash: de2acac12e08929d
@generated: 2026-02-09T18:15:12Z

## Purpose

Node.js build script that resolves workspace:* dependencies to concrete versions for package publishing. Mimics pnpm's automatic workspace dependency resolution by reading workspace packages and replacing workspace:* references with actual version numbers in package.json.

## Key Functions

- **getWorkspaceVersions() (L27-43)**: Scans hardcoded workspace package directories to collect name/version mappings. Reads package.json files from 'shared', 'adapter-javascript', 'adapter-python', 'adapter-mock', 'adapter-rust' workspaces.

- **resolveWorkspaceDeps() (L46-85)**: Core resolution logic that replaces workspace:* dependencies with concrete versions across dependencies, devDependencies, and peerDependencies. Uses nested helper function resolveDeps() (L50-68) to process each dependency section.

- **main() (L87-136)**: CLI entry point supporting two commands:
  - 'prepare': Backs up original package.json, resolves workspace deps, writes modified version
  - 'restore': Restores original package.json from backup

- **log()/warn() (L18-24)**: Utility functions for consistent logging output with [prepare-pack] prefix.

## Configuration & Constants

- **PACKAGE_DIR (L14)**: Hardcoded to '../packages/mcp-debugger' relative to script location
- **Workspace list (L32)**: Hardcoded array of workspace package names to scan

## Key Behaviors

- Creates backup file (package.json.backup) before modifications
- Automatically restores from backup if found during prepare command
- Throws error if workspace dependency cannot be resolved (L59)
- Preserves non-workspace dependencies unchanged
- Adds newline to final JSON output for consistency

## Dependencies

- Node.js built-ins: fs, path, url (fileURLToPath for ES module __dirname emulation)
- Uses ES modules with import statements