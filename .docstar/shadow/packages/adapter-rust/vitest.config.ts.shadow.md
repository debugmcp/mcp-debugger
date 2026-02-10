# packages/adapter-rust/vitest.config.ts
@source-hash: fe397d6a657d0a8a
@generated: 2026-02-09T18:14:57Z

## Purpose
Vitest configuration file for the `adapter-rust` package, setting up testing environment with TypeScript support and module resolution.

## Configuration Structure
- **Main Config Export (L4-23)**: Default Vitest configuration object with test and resolve sections
- **Test Configuration (L5-16)**: Defines test environment, file patterns, and module aliases
- **Resolve Configuration (L17-22)**: Sets up module resolution for TypeScript files

## Key Settings
- **Test Environment (L7)**: Node.js environment for server-side testing
- **File Patterns (L8)**: Includes test files in `tests/` and `src/` directories with `.test.ts` or `.spec.ts` extensions
- **Exclusions (L9)**: Excludes `node_modules` and `dist` directories from test discovery
- **JS Extension Handling (L12)**: Regex alias to strip `.js` extensions from imports, enabling TypeScript imports with JS extensions
- **Workspace Alias (L14, L20)**: Maps `@debugmcp/shared` to local shared package source for development

## Dependencies
- **vitest/config**: Vitest configuration utilities
- **path**: Node.js path module for resolving workspace paths

## Architecture Notes
- Duplicated alias configuration in both `test.alias` and `resolve.alias` sections ensures consistent module resolution across test and build contexts
- Extension handling supports TypeScript compilation where `.ts` files are imported with `.js` extensions
- Workspace-relative path resolution enables local development without published packages