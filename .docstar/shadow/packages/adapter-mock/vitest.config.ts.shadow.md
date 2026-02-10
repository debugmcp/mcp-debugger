# packages/adapter-mock/vitest.config.ts
@source-hash: fe397d6a657d0a8a
@generated: 2026-02-09T18:14:56Z

## Purpose
Vitest test configuration file for the `adapter-mock` package, setting up the testing environment with TypeScript support and workspace dependencies.

## Configuration Structure

### Test Configuration (L5-16)
- **globals**: Enables global test functions (L6)
- **environment**: Node.js runtime environment for tests (L7)
- **include**: Test file patterns covering `tests/` and `src/` directories (L8)
- **exclude**: Standard exclusions for dependencies and build output (L9)

### Alias Configuration (L10-15, L19-21)
- **JS extension handling**: Regex alias to strip `.js` extensions from imports (L12)
- **Workspace dependency**: Maps `@debugmcp/shared` to local TypeScript source file in sibling package (L14, L20)

### Resolve Configuration (L17-22)
- **File extensions**: TypeScript-first resolution order with fallbacks (L18)
- **Duplicate alias**: Redundant workspace alias definition for module resolution (L20)

## Dependencies
- `vitest/config`: Test framework configuration utility (L1)
- `path`: Node.js path manipulation for workspace resolution (L2)

## Architecture Notes
- Workspace-aware configuration enabling local development with shared packages
- TypeScript-first setup with JavaScript import compatibility
- Dual alias definitions suggest potential for consolidation