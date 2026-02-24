# examples\javascript\tsconfig.json
@source-hash: eca29bd9f1f71555
@generated: 2026-02-24T01:54:03Z

**TypeScript Configuration for JavaScript Examples**

This tsconfig.json file configures TypeScript compilation settings for JavaScript example code in a project. The configuration targets modern ES2020 JavaScript with CommonJS modules, emphasizing strict type checking and development-friendly settings.

## Compiler Options (L2-18)
- **Target & Module**: ES2020 target with CommonJS modules (L3-4)
- **Output Configuration**: Same-directory compilation with source maps enabled (L6-8)
- **Type Safety**: Strict mode enabled with consistent casing enforcement (L9, 12)
- **Module Resolution**: ES module interop and JSON module resolution enabled (L10, 13)
- **Declaration Files**: Disabled for both .d.ts files and declaration maps (L14-15)
- **Source Maps**: External source maps enabled, inline disabled (L8, 16)
- **Comments**: Preserved in compiled output (L17)

## File Inclusion Strategy (L19-26)
- **Includes**: Single TypeScript test file `typescript_test.ts` (L20)
- **Excludes**: Standard exclusions for node_modules and test files with .spec/.test patterns (L23-25)

This configuration appears designed for compiling a specific TypeScript example file while excluding typical test and dependency files from compilation.