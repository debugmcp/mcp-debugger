# vitest.config.ts
@source-hash: 1f3c0b27f7d186d9
@generated: 2026-02-11T16:12:56Z

## Primary Purpose
Vitest configuration file for a monorepo MCP debugger project with multiple language adapters. Sets up comprehensive testing infrastructure with custom console filtering, coverage reporting, and TypeScript/ESM module handling.

## Key Configuration Sections

### Test Discovery & Execution (L5-23)
- **Test patterns**: Includes tests from main project and packages subdirectories (L10-15)
- **Environment**: Node.js environment with globals enabled (L6-7)
- **Setup**: Uses `./tests/vitest.setup.ts` for test initialization (L8)
- **Exclusions**: Standard build artifacts and node_modules (L17-22)

### Console Output Filtering (L24-87)
- **Reporter strategy**: Conditional reporters - dot for CI, default for local (L24)
- **onConsoleLog function (L29-87)**: Sophisticated log filtering system
  - **Whitelist patterns (L31-44)**: Always shows errors, test failures, and specific test tags
  - **Noise patterns (L50-74)**: Filters build tools, debug logs, timestamps, and verbose output
  - **Test-specific logic (L81-83)**: Allows console.log in test files
  - **Default behavior (L86)**: Suppresses stdout, keeps stderr

### Performance & Parallelism (L88-136)
- **Single-threaded execution (L89, L132-135)**: Critical for process spawning tests
- **Test timeout**: 30 seconds (L128)
- **Pool configuration**: Threads pool with forced single-thread mode (L129-136)

### Coverage Configuration (L90-127)
- **Provider**: Istanbul instead of v8 (L91)
- **Output formats**: text, json, html, json-summary (L92)
- **Extensive exclusions (L95-122)**: Type files, test files, CLI entry points, process-level code
- **Include patterns (L123)**: Source files in src/ and packages/*/src/
- **Deduplication**: `all: false` prevents duplicate coverage tracking (L126)

### Module Resolution (L141-158)
- **TypeScript handling**: Maps .js imports to .ts files for both relative and absolute paths (L145-148)
- **Project aliases (L151-157)**: Maps @debugmcp/* packages to their TypeScript source files
- **Extensions**: Supports .ts, .js, .json, .node (L142)

### ESM Optimization (L161-163)
- **External dependencies**: Pre-bundles MCP SDK and VSCode debug adapter modules

## Architectural Decisions

1. **Monorepo structure**: Supports main project + multiple adapter packages
2. **TypeScript-first**: Heavy emphasis on .ts file resolution and transformation
3. **Process isolation**: Single-threaded execution suggests inter-process testing
4. **Noise reduction**: Sophisticated console filtering for cleaner test output
5. **Coverage precision**: Excludes infrastructure code, focuses on business logic

## Dependencies
- **vitest/config**: Test runner configuration
- **path**: Node.js path utilities for alias resolution

## Critical Constraints
- Must run single-threaded due to process spawning tests
- TypeScript import/export mapping required for proper module resolution
- Console filtering essential for manageable test output in complex system