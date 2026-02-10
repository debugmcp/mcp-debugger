# packages/shared/vitest.config.ts
@source-hash: a85c5636cfedc300
@generated: 2026-02-10T00:41:42Z

## Purpose
Test configuration file for Vitest testing framework in the shared package. Configures test environment, coverage reporting, and module resolution settings.

## Configuration Structure
- **Main export** (L4-26): Default Vitest configuration object using `defineConfig`
- **Test settings** (L5-19): Core test environment and coverage configuration
- **Module resolution** (L20-25): Path aliases and file extension handling

## Key Configuration Sections

### Test Environment (L5-19)
- **globals**: Enables global test functions (describe, it, expect) without imports
- **environment**: Set to 'node' for server-side testing context
- **coverage** (L8-18): Istanbul-based code coverage with multiple output formats

### Coverage Settings (L8-18)
- **provider**: Uses Istanbul for coverage analysis
- **reporter**: Outputs text, JSON, and HTML coverage reports
- **exclude** (L11-17): Excludes common non-source directories and test files from coverage

### Module Resolution (L20-25)
- **extensions**: Supports TypeScript, JavaScript, and JSON imports
- **alias** (L22-24): Maps '@' to './src' directory for cleaner imports

## Dependencies
- `vitest/config`: Core Vitest configuration utilities
- `path`: Node.js path manipulation for alias resolution

## Architectural Notes
- Standard monorepo shared package test configuration
- Istanbul coverage provider chosen over c8 for compatibility
- Alias setup suggests src-based project structure
- Excludes test files from coverage to focus on source code metrics