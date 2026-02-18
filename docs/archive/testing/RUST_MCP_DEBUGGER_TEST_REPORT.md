# Rust MCP Debugger Test Report

**Date**: November 13, 2025  
**Tester**: Cline  
**Task**: Test mcp-debugger on Rust language examples and document issues  

## Executive Summary

Testing of the mcp-debugger on Rust examples was **unsuccessful** due to a critical path resolution bug that prevents CodeLLDB from being found. The CodeLLDB executable is properly vendored in the correct location (`packages/adapter-rust/vendor/codelldb/win32-x64/adapter/codelldb.exe`), but the runtime path resolution logic fails to locate it.

## Test Environment

- **Operating System**: Windows 11
- **Working Directory**: `C:/path/to/debug-mcp-server`
- **MCP Server**: mcp-debugger (running via Node.js)
- **Language**: Rust
- **Examples Tested**: 
  - `examples/rust/hello_world/` (attempted)
  - `examples/rust/async_example/` (not reached)

## Test Execution

### 1. Example Discovery
✅ **PASSED** - Successfully identified available Rust examples:
- `hello_world/` - Basic Rust program with variables, functions, loops
- `async_example/` - Async/await with Tokio runtime

### 2. Documentation Review
✅ **PASSED** - Reviewed documentation files:
- `examples/rust/README.md` - Example usage instructions
- `docs/rust-debugging.md` - Comprehensive Rust debugging guide

### 3. Debug Session Creation
✅ **PASSED** - Successfully created a debug session:
```json
{
  "language": "rust",
  "name": "Hello World Test",
  "sessionId": "c16d10ea-9433-46ea-9933-cfd300bcc9c3"
}
```

### 4. Breakpoint Setting
✅ **PASSED** - Successfully set breakpoint:
```json
{
  "file": "C:/path/to/debug-mcp-server/examples/rust/hello_world/src/main.rs",
  "line": 14,
  "breakpointId": "8b6c3725-9dbd-4209-8868-02ffea77cdec",
  "verified": false
}
```
Note: Breakpoint was unverified (expected before debugging starts)

### 5. Start Debugging
❌ **FAILED** - Error starting debugger:
```json
{
  "success": false,
  "state": "error",
  "message": "CodeLLDB executable not found. Run: npm run build:adapter"
}
```

## Root Cause Analysis

### Problem: CodeLLDB Not Found

The error message "CodeLLDB executable not found" is **misleading** because CodeLLDB is actually present and properly vendored:

**Verified CodeLLDB Location**:
```
packages/adapter-rust/vendor/codelldb/win32-x64/adapter/codelldb.exe
```

### Root Cause: Path Resolution Bug

The issue is in how the code resolves the path to CodeLLDB at runtime. There are **two files** with the same bug:

#### 1. `packages/adapter-rust/src/utils/codelldb-resolver.ts` (Lines 30-37)

```typescript
const codelldbPath = path.resolve(
  __dirname,
  '..',           // ❌ WRONG: Only goes up one level
  'vendor',
  'codelldb',
  platformDir,
  'adapter',
  executableName
);
```

#### 2. `packages/adapter-rust/src/rust-debug-adapter.ts` (Lines 473-481)

```typescript
const codelldbPath = path.resolve(
  __dirname,
  '..',           // ❌ WRONG: Only goes up one level
  'vendor',
  'codelldb',
  platformDir,
  'adapter',
  executableName
);
```

### Why This Fails

When TypeScript compiles to JavaScript:
- Source files in `src/utils/` → Compiled to `dist/utils/`
- Source files in `src/` → Compiled to `dist/`

**Current (broken) path resolution from `dist/utils/codelldb-resolver.js`**:
```
__dirname = packages/adapter-rust/dist/utils/
Path resolves to: packages/adapter-rust/dist/utils/../vendor/codelldb/...
                = packages/adapter-rust/dist/vendor/codelldb/...
❌ This directory doesn't exist!
```

**Current (broken) path resolution from `dist/rust-debug-adapter.js`**:
```
__dirname = packages/adapter-rust/dist/
Path resolves to: packages/adapter-rust/dist/../vendor/codelldb/...
                = packages/adapter-rust/vendor/codelldb/...
✅ This would work from rust-debug-adapter.ts!
```

However, the resolution actually fails because `codelldb-resolver.ts` is called first (during initialization), and it's in the `dist/utils/` subdirectory.

### The Fix Required

Both files need to go up **two levels** from their compiled location:

**For `codelldb-resolver.ts` (in dist/utils/)**:
```typescript
const codelldbPath = path.resolve(
  __dirname,
  '..',           // dist/utils/ → dist/
  '..',           // dist/ → packages/adapter-rust/
  'vendor',
  'codelldb',
  platformDir,
  'adapter',
  executableName
);
```

**For `rust-debug-adapter.ts` (in dist/)**:
```typescript
const codelldbPath = path.resolve(
  __dirname,
  '..',           // dist/ → packages/adapter-rust/
  'vendor',
  'codelldb',
  platformDir,
  'adapter',
  executableName
);
```

### Why The Version Check Has Different Logic

Interestingly, in `codelldb-resolver.ts` line 85, the version check uses **two levels up** (`'..'`, `'..'`):

```typescript
const versionFile = path.resolve(
  __dirname,
  '..',
  '..',           // ✅ CORRECT: Goes up two levels
  'vendor',
  'codelldb',
  platformDir,
  'version.json'
);
```

This suggests the developers recognized the issue for the version file but didn't apply the same fix to the executable path resolution.

## Impact Assessment

### Severity: **CRITICAL**
- **Blocks all Rust debugging**: Cannot start any debug sessions
- **Affects all platforms**: The bug exists for Windows, macOS, and Linux
- **Misleading error message**: Suggests running `npm run build:adapter` when CodeLLDB is already properly installed

### Affected Components
1. ✅ CodeLLDB vendoring - Working correctly
2. ❌ CodeLLDB path resolution - **BROKEN**
3. ❓ Rust adapter initialization - Cannot test (blocked by path issue)
4. ❓ DAP communication - Cannot test (blocked by path issue)
5. ❓ Breakpoint handling - Cannot test (blocked by path issue)
6. ❓ Variable inspection - Cannot test (blocked by path issue)
7. ❓ Stepping operations - Cannot test (blocked by path issue)
8. ❓ Async debugging - Cannot test (blocked by path issue)

## Tests Not Executed

Due to the blocking path resolution bug, the following tests could not be performed:

### Hello World Example
- [ ] Debug session initialization
- [ ] Breakpoint verification after launch
- [ ] Stepping through code
- [ ] Variable inspection (primitives, strings, vectors)
- [ ] Function call stack
- [ ] Continue execution
- [ ] Loop iteration stepping

### Async Example
- [ ] Tokio runtime debugging
- [ ] Async function stepping
- [ ] Future inspection
- [ ] Concurrent task debugging
- [ ] Async stack traces

## Additional Observations

### Documentation Quality
✅ **Excellent** - The Rust debugging documentation is comprehensive and well-organized:
- Clear prerequisites
- Detailed setup instructions
- Common debugging scenarios
- Troubleshooting section
- Known limitations

### Example Code Quality
✅ **Good** - Example code is well-commented and demonstrates key debugging features:
- `hello_world.rs`: Simple, clear demonstration of basics
- `async_example.rs`: Good coverage of async patterns

### Error Messages
⚠️ **Could Be Improved**:
- Current: "CodeLLDB executable not found. Run: npm run build:adapter"
- Better: "CodeLLDB path resolution failed. Expected at: [path]. Check if vendor directory exists."

## Recommendations

### Immediate Actions (Priority 1)
1. **Fix path resolution bug** in `codelldb-resolver.ts`:
   - Change line 30 from one `'..'` to two `'..'` levels up
   - Apply same fix as used for version file (line 85)

2. **Fix path resolution bug** in `rust-debug-adapter.ts`:
   - Update line 473 to use correct number of `'..'` based on output location

3. **Add path resolution unit test**:
   - Verify CodeLLDB can be found from compiled code
   - Test on all platforms (Windows, macOS, Linux)

### Short-term Improvements (Priority 2)
1. **Improve error message**:
   - Show attempted path when CodeLLDB not found
   - Distinguish between "not vendored" vs "path resolution failed"

2. **Add validation script**:
   - Create a script to verify CodeLLDB installation
   - Check both vendored location and path resolution

3. **Document build structure**:
   - Explain src/ → dist/ compilation in developer docs
   - Document path resolution strategy

### Long-term Improvements (Priority 3)
1. **Consolidate path logic**:
   - Create single source of truth for paths
   - Reduce duplication between resolver and adapter

2. **Consider alternative approaches**:
   - Use package.json directory as anchor point
   - Use environment variable with default fallback
   - Package CodeLLDB differently (e.g., in dist/)

## Conclusion

The mcp-debugger Rust adapter has a **critical path resolution bug** that prevents any Rust debugging from working. The bug is straightforward to fix - it's a simple matter of adjusting the number of parent directory traversals (`'..'`) in the path resolution logic.

CodeLLDB itself is properly vendored and ready to use. Once the path resolution is fixed, the adapter should be able to:
1. Locate CodeLLDB executable
2. Launch debugging sessions
3. Support all documented Rust debugging features

The documentation and example code are of high quality, and the underlying architecture appears sound. This is purely a path resolution issue introduced during the TypeScript → JavaScript compilation process.

## Appendix A: File Structure

```
packages/adapter-rust/
├── src/
│   ├── utils/
│   │   └── codelldb-resolver.ts      (❌ Bug here)
│   └── rust-debug-adapter.ts         (❌ Bug here)
├── dist/                              (Compiled output)
│   ├── utils/
│   │   └── codelldb-resolver.js      (__dirname = dist/utils/)
│   └── rust-debug-adapter.js         (__dirname = dist/)
└── vendor/
    └── codelldb/
        └── win32-x64/
            └── adapter/
                └── codelldb.exe       (✅ Present)
```

## Appendix B: Expected vs Actual Paths

### From `dist/utils/codelldb-resolver.js`:

**Expected (Correct)**:
```
packages/adapter-rust/dist/utils/ + ../.. = packages/adapter-rust/
packages/adapter-rust/ + vendor/codelldb/win32-x64/adapter/codelldb.exe
```

**Actual (Wrong)**:
```
packages/adapter-rust/dist/utils/ + .. = packages/adapter-rust/dist/
packages/adapter-rust/dist/ + vendor/codelldb/win32-x64/adapter/codelldb.exe
```

### From `dist/rust-debug-adapter.js`:

**Expected (Correct)**:
```
packages/adapter-rust/dist/ + .. = packages/adapter-rust/
packages/adapter-rust/ + vendor/codelldb/win32-x64/adapter/codelldb.exe
```

**Actual (Wrong for consistency, though would work)**:
```
Same as expected, but should match the resolver pattern
```

---

**Report Status**: Complete  
**Testing Status**: Blocked by critical bug  
**Ready for Fix**: Yes - Issue clearly identified with proposed solution
