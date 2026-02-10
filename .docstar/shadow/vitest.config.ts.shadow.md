# vitest.config.ts
@source-hash: 471e754816d5a15b
@generated: 2026-02-09T18:15:19Z

**Primary Purpose**: Vitest configuration file for a multi-package TypeScript project with monorepo structure, debugging tools, and MCP (Model Context Protocol) adapter packages.

**Key Configuration Sections**:

**Test Configuration (L5-140)**:
- `globals: true` (L6) - Enables global test APIs
- `environment: 'node'` (L7) - Node.js test environment 
- `setupFiles` (L8) - Points to `./tests/vitest.setup.ts` for test initialization
- Multi-package test discovery (L10-15) - Includes tests from main project and all packages
- Standard exclusion patterns (L17-22) for `node_modules` and `dist` directories

**Console Output Management (L29-87)**:
- `onConsoleLog` function provides sophisticated console filtering
- Important patterns whitelist (L31-44) - Always shows errors, assertions, and specific test markers
- Noise patterns blacklist (L50-74) - Filters build tools, debug output, timestamps, and verbose logging
- Special handling for test files and stderr output

**Performance & Execution (L88-136)**:
- `fileParallelism: false` (L89) - Disables parallel file execution for cleaner output
- Single-threaded pool configuration (L130-136) - Critical for process spawning tests
- 30-second test timeout (L128)

**Coverage Configuration (L90-127)**:
- Istanbul provider (L91) with comprehensive reporter setup (L92)
- Extensive exclusion list (L95-122) covering:
  - Test files and directories
  - Type definition files
  - CLI entry points and process-level code
  - Mock adapters and proxy processes
  - Factory patterns and barrel exports
- `all: false` (L126) - Only tracks imported files to prevent duplicate coverage

**Module Resolution (L141-160)**:
- TypeScript-first resolution with `.js` to `.ts` mapping (L145-148)
- Monorepo package aliases (L152-158) - Maps `@debugmcp/*` packages to their TypeScript sources
- Core alias `@` maps to `./src` (L151)

**Dependencies (L162-164)**:
- Pre-optimizes ESM modules: `@modelcontextprotocol/sdk`, `@vscode/debugadapter`, `@vscode/debugprotocol`

**Architectural Decisions**:
- Monorepo-aware test discovery across packages
- Single-threaded execution for process management reliability  
- Aggressive console noise filtering for debugging workflows
- TypeScript-centric module resolution with JS compatibility
- Coverage exclusions reflect architectural boundaries (CLI vs library code)