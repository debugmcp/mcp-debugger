# CI Test Failure Investigation - TypeScript Declaration Files

## Problem Statement

The CI/CD pipeline on GitHub Actions (Ubuntu) is failing with TS7016 errors indicating missing TypeScript declaration files for the `@debugmcp/shared` package, even though:
- The same build works locally on Windows
- TypeScript is configured with `declaration: true`
- The `.d.ts.map` files ARE being generated
- Only the actual `.d.ts` files are missing

## Error Details

```
Error: src/mock-adapter-factory.ts(14,8): error TS7016: Could not find a declaration file for module '@debugmcp/shared'. 
'/home/runner/work/mcp-debugger/mcp-debugger/packages/shared/dist/index.js' implicitly has an 'any' type.
```

## Environment Comparison

### Local (Windows - Working)
- Platform: win32
- Node: v22.13.1
- TypeScript: 5.9.2
- Result: All `.d.ts` files generated successfully

### CI (Ubuntu - Failing)
- Platform: Ubuntu 24.04.3 LTS
- Node: v20.19.5
- TypeScript: Unknown (pending diagnostic output)
- Result: `.d.ts` files not generated, only `.d.ts.map` files

## Configuration

### packages/shared/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### packages/shared/src/index.ts
- Uses `.js` extensions in all imports (ESM style)
- Example: `export { AdapterState } from './interfaces/debug-adapter.js';`

## Investigation Steps Taken

1. **Initial debugging**: Added logging to show what files are in dist directory
2. **Fallback mechanism**: Created ensure-declarations.cjs script with multiple fallback strategies
3. **Comprehensive diagnostics**: Added platform/version logging and multiple TypeScript compilation attempts

## Diagnostic Script Output (Pending CI Run)

The enhanced diagnostic script will provide:
- Node version and platform
- TypeScript version
- Directory contents before/after build attempts
- TypeScript error checking
- Multiple fallback strategies with different module systems

## Potential Root Causes

1. **TypeScript + ESM + NodeNext issue**: Known edge case with `.js` extensions in imports
2. **File system case sensitivity**: Ubuntu is case-sensitive, Windows isn't
3. **TypeScript version mismatch**: Different behavior between versions
4. **Silent TypeScript errors**: Errors that prevent declaration emission but don't fail the build
5. **Node version differences**: v20 vs v22 might handle ESM differently

## Research Questions for Further Investigation

1. Are there known TypeScript bugs with declaration generation when using:
   - `module: "NodeNext"` 
   - `.js` extensions in imports
   - Monorepo with project references

2. What are the differences in TypeScript's module resolution between:
   - Windows vs Linux
   - Node v20 vs v22

3. Are there workarounds used by other projects facing similar issues?

4. Would alternative configurations work:
   - Using `module: "ES2022"` instead of "NodeNext"
   - Removing `.js` extensions from imports
   - Using a bundler like esbuild or rollup for declarations

## Next Steps

1. ✅ Push diagnostic changes to GitHub
2. ⏳ Analyze diagnostic output from CI
3. 🔍 Research TypeScript + ESM declaration generation issues
4. 📝 Create research task with specific queries
5. 🔧 Implement permanent solution based on findings

## CI Run Links

- PR: https://github.com/debugmcp/mcp-debugger/pull/5
- Latest CI Run: [Pending diagnostic run]

## Temporary Workarounds Considered

1. **Generate declarations separately**: Use a separate TypeScript config just for declarations
2. **Use CommonJS**: Switch to CommonJS module system (breaks ESM compatibility)
3. **Manual declaration files**: Create .d.ts files manually
4. **Use a build tool**: Use Rollup or esbuild to handle declaration generation

## Notes

This issue appears to be a complex interaction between:
- TypeScript's module resolution
- ESM vs CommonJS 
- Platform differences
- Node.js version differences
- Monorepo/workspace package structure

The fact that `.d.ts.map` files are generated but not `.d.ts` files suggests TypeScript is partially working but failing silently during the declaration emission phase.
