# packages/adapter-javascript/vitest.config.ts
@source-hash: 6dc87debc6acf273
@generated: 2026-02-10T00:41:42Z

## Vitest Test Configuration

This file configures the Vitest testing framework for the JavaScript adapter package. It defines comprehensive test execution, coverage reporting, and module resolution settings.

### Core Configuration (L4-32)
- **Test Environment**: Node.js environment with global test APIs enabled (L5-7)
- **Test Discovery**: Includes test files from `tests/` and `src/` directories with `.test` or `.spec` extensions (L8)
- **Exclusions**: Excludes standard directories like `node_modules` and `dist` (L9)

### Coverage Configuration (L10-18)
- **Provider**: Uses V8 coverage provider for accurate instrumentation (L11)
- **Reporting**: Generates both text and LCOV format reports (L12)
- **Output**: Coverage reports stored in `coverage/` directory (L13)
- **Thresholds**: Enforces 90% coverage minimum for lines, branches, functions, and statements (L17)
- **Coverage Exclusions**: Excludes test files, vendor code, build artifacts, scripts, type definitions, and specific adapter files (L16)

### Module Resolution (L19-31)
- **JavaScript Extension Handling**: Strips `.js` extensions from relative imports using regex pattern (L21)
- **Workspace Aliases**: Maps `@debugmcp/shared` to the local shared package source (L23, L29)
- **File Extensions**: Resolves `.ts`, `.js`, `.json`, and `.node` files (L27)

### Key Dependencies
- `vitest/config` for configuration definition
- `path` module for resolving workspace aliases

### Architectural Notes
- Configured for TypeScript-first development with Node.js runtime
- Supports monorepo structure with shared package aliasing
- High coverage standards enforced (90% across all metrics)
- Excludes specific adapter implementation files from coverage, suggesting they may be integration/factory code