# TypeScript Source Map Investigation

## Executive Summary

TypeScript debugging with source maps is currently under development. While the JavaScript adapter successfully debugs compiled JavaScript files, automatic source map resolution to TypeScript source files is not yet fully functional.

## Test Results (November 6, 2025)

### What Works ✅
1. **JavaScript debugging**: The debugger successfully debugs the compiled JavaScript file
2. **Stepping operations**: Step over, step into, continue execution all work
3. **Pausing execution**: `stopOnEntry` works correctly
4. **Variable inspection**: Variables can be inspected (though showing transpiled names)
5. **Async debugging**: Async/await operations are debuggable
6. **Runtime transpilers**: `tsx` and `ts-node` work correctly for direct TypeScript debugging

### Limitations Found ⚠️

1. **Source Map Resolution**: 
   - Stack traces show JavaScript file paths, not TypeScript
   - Breakpoints must be set on the JavaScript file, not TypeScript directly
   - Line numbers don't map back to TypeScript source

2. **Variable Names**:
   - Shows transpiled variable names (e.g., `_a` for generator state)
   - TypeScript type information is not available

## Root Cause Analysis

The issue lies in how the adapter processes the `program` parameter when starting debugging:

### Current Implementation
```javascript
// In JavaScriptAdapter.transformLaunchConfig()
const isTS = program.endsWith('.ts');
if (isTS) {
  result.sourceMaps = true;
  result.outFiles = ['**/*.js', '!**/node_modules/**'];
  result.resolveSourceMapLocations = ['**', '!**/node_modules/**'];
}
```

### The Problem

When a user compiles TypeScript:
```
typescript_test.ts --[tsc]--> typescript_test.js + typescript_test.js.map
```

**Current behavior**: The adapter passes the `.ts` file directly to js-debug  
**Expected behavior**: The adapter should pass the compiled `.js` file to js-debug with source maps enabled

js-debug expects to debug the JavaScript file and use source maps to map back to TypeScript. It cannot debug TypeScript files directly without a runtime transpiler.

## Proposed Solutions

### Solution 1: Smart Path Resolution (Recommended)

When `program` is a `.ts` file:
1. Check if corresponding `.js` file exists (same path, `.js` extension)
2. If yes: Use `.js` as program with sourceMaps enabled
3. If no: Warn user to compile first or suggest using tsx/ts-node

**Implementation:**
```javascript
if (program.endsWith('.ts')) {
  const jsPath = program.replace(/\.ts$/, '.js');
  if (fs.existsSync(jsPath)) {
    result.program = jsPath;
    result.sourceMaps = true;
    result.outFiles = ['**/*.js', '!**/node_modules/**'];
  } else {
    // Warn or fall back to runtime transpiler
  }
}
```

### Solution 2: Continue with Runtime Transpilers (Current Workaround)

The adapter already detects and uses tsx/ts-node when available:
```javascript
if (isTS && !executablePath) {
  const tsxPath = await which('tsx').catch(() => null);
  if (tsxPath) {
    result.runtimeExecutable = tsxPath;
  }
}
```

This approach works today but requires additional dependencies.

### Solution 3: Document as Known Limitation

Be transparent about current limitations and provide clear workarounds.

## Current Workarounds

Until full source map support is implemented:

### Option 1: Debug Compiled JavaScript
```bash
# Compile TypeScript
tsc typescript_test.ts

# Debug the JavaScript file
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "typescript_test.js"  // Use .js, not .ts
  }
}
```

### Option 2: Use Runtime Transpiler
```bash
# Install tsx or ts-node
npm install -g tsx

# Debug TypeScript directly
{
  "tool": "start_debugging",
  "params": {
    "sessionId": "session-id",
    "scriptPath": "typescript_test.ts"  // tsx handles compilation
  }
}
```

## Implementation Roadmap

### Phase 1: Documentation (Current)
- [x] Remove incorrect TypeScript claims from documentation
- [x] Document known limitations clearly
- [x] Provide workaround instructions

### Phase 2: Smart Path Resolution (Next Release)
- [ ] Implement .ts → .js path resolution logic
- [ ] Add file existence checking
- [ ] Provide helpful error messages when .js doesn't exist
- [ ] Test with various TypeScript configurations

### Phase 3: Full Source Map Support (Future)
- [ ] Investigate js-debug's internal source map handling
- [ ] Consider pre-processing source maps in adapter layer
- [ ] Support for various source map configurations
- [ ] Handle inline source maps and external .map files

## Technical Details

### Test Configuration
```json
// tsconfig.json used in testing
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "sourceMap": true,
    "outDir": "./",
    "strict": true
  }
}
```

### Example Debug Session Output
```javascript
// Stack trace shows JavaScript, not TypeScript
{
  "stackFrames": [
    {
      "file": "c:\\path\\to\\typescript_test.js",  // Not .ts
      "line": 78,  // JavaScript line number
      "name": "fetchData"
    }
  ]
}
```

## Conclusion

The JavaScript adapter has the foundation for TypeScript support, but requires additional work to properly handle the compiled JavaScript workflow. The recommended approach is to implement smart path resolution in the next release while maintaining support for runtime transpilers as an alternative.

## References

- [Microsoft js-debug Documentation](https://github.com/microsoft/vscode-js-debug)
- [Debug Adapter Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
- [Source Map v3 Specification](https://sourcemaps.info/spec.html)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
