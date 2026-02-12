# scripts\prepare-pack.js
@source-hash: 17919bce2abf332e
@generated: 2026-02-12T21:00:32Z

## Purpose
Build script that prepares npm packages for distribution by resolving workspace:* dependencies to concrete versions, mimicking pnpm publish behavior. Operates specifically on the `mcp-debugger` package within a monorepo structure.

## Key Functions

**getWorkspaceVersions() (L27-43)**: Scans hardcoded workspace packages (`shared`, `adapter-go`, `adapter-javascript`, `adapter-python`, `adapter-mock`, `adapter-rust`) and extracts their current versions from package.json files. Returns a name->version mapping.

**resolveWorkspaceDeps(pkg, versions) (L46-85)**: Core transformation function that replaces `workspace:*` dependency references with concrete version numbers. Processes `dependencies`, `devDependencies`, and `peerDependencies` sections using internal `resolveDeps` helper (L50-68). Throws error if workspace dependency cannot be resolved.

**main() (L87-136)**: CLI entry point supporting two commands:
- `prepare`: Creates backup of original package.json, resolves workspace deps, writes updated file
- `restore`: Restores original package.json from backup

## Configuration & Constants
- **PACKAGE_DIR** (L14): Hardcoded path to `../packages/mcp-debugger`
- **PACKAGE_JSON/BACKUP_JSON** (L15-16): Target and backup file paths
- **Workspace list** (L32): Hardcoded array of known workspace packages

## Dependencies
- Node.js built-ins: `fs`, `path`, `url`
- Uses ES modules with `import.meta.url` for path resolution (L11-12)

## Architecture Notes
- Single-package focused (only processes mcp-debugger)
- Backup/restore pattern prevents data loss during transformations
- Synchronous file operations throughout
- Error handling via try/catch in main async wrapper (L138-141)

## Critical Constraints
- Workspace package names must be discoverable in hardcoded locations
- Backup mechanism assumes single concurrent execution
- No validation of resolved version formats or semver compatibility