# packages/mcp-debugger/scripts/bundle-cli.js
@source-hash: bcf04facb9fd8345
@generated: 2026-02-09T18:14:34Z

**MCP Debugger CLI Bundle Script**

This script orchestrates the complete build pipeline for the MCP debugger CLI distribution, producing three key artifacts: runtime bundle in `dist/`, mirrored package bundle, and npm tarball.

## Core Functions

**bundleProxy() (L23-45)**: Bundles the DAP proxy component using tsup with CommonJS format targeting Node 18. Outputs to `dist/proxy/proxy-bundle.cjs` from the repo-level `dist/proxy/dap-proxy-entry.js` source.

**bundleCLI() (L47-213)**: Main bundling orchestrator performing:
1. CLI bundle creation via tsup (L54-77) - outputs ESM format with `.mjs` extension
2. Wrapper script generation (L79-93) - creates executable shim with shebang
3. Runtime asset copying (L98-118) - mirrors repo dist directories (proxy, errors, adapters, session, utils)
4. Vendor payload integration (L123-190) - handles js-debug and CodeLLDB platform-specific binaries
5. Package mirroring (L192-203) - duplicates dist to package/ for npm pack
6. Tarball generation (L205-210) - creates distributable npm package

## Key Dependencies & Configuration

- **tsup**: Primary bundler for both CLI and proxy components
- **Platform handling**: Environment variable `CODELLDB_PACKAGE_PLATFORMS` controls Rust debugger inclusion
- **Shell commands**: Uses `execSync` with `cp`/`rm` for file operations to handle permission issues
- **Path resolution**: Calculates repo structure from script location (L18-21)

## Bundle Strategy

The CLI bundle uses ESM with require shim injection (L68-72) and creates a wrapper for execution safety (L81-88). Vendor payloads are conditionally included based on availability - js-debug from adapter-javascript and CodeLLDB from adapter-rust with platform filtering.

## Error Handling

Graceful degradation for missing vendor components with warning messages and build instructions. File operation failures are caught and logged as warnings to prevent pipeline interruption.