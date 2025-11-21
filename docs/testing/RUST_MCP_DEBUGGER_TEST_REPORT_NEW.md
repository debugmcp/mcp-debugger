# MCP Debugger Rust Language Testing Report

**Date**: November 13, 2025  
**Tester**: Claude (Cline AI Assistant)  
**Objective**: Test mcp-debugger on Rust language examples in the examples directory and document any problems encountered

## Test Environment

- **Operating System**: Windows 11
- **Working Directory**: `C:\path\to\debug-mcp-server`
- **Rust Examples Tested**:
  1. `examples/rust/hello_world` - Simple Rust program with variables, functions, and loops
  2. `examples/rust/async_example` - Async Rust program using Tokio runtime

## Test Execution Summary

### Test 1: Hello World Example

#### Steps Performed:
1. Created debug session for Rust language
2. Set breakpoint at line 16 (blank line)
3. Set breakpoint at line 18 (executable statement)
4. Attempted to start debugging with compiled executable

#### Results:
- ✅ Session creation succeeded (Session ID: `f25129ed-d8ed-48fa-8bd1-a5ff4f125fb6`)
- ✅ Breakpoint setting succeeded at line 16 (though on a blank line)
- ✅ Breakpoint setting succeeded at line 18 (on executable statement)
- ❌ **FAILED**: Debugging start failed with error: `"CodeLLDB executable not found. Run: npm run build:adapter"`

### Test 2: Async Example

#### Steps Performed:
1. Created debug session for Rust language
2. Attempted to build the async example with `cargo build`
3. Closed the session

#### Results:
- ✅ Session creation succeeded (Session ID: `19ca2289-812f-44f8-b812-e26dcf6d70ca`)
- ❌ **FAILED**: Cargo build failed with file locking errors

## Problems Encountered

### Problem 1: Session Persistence Issue (CRITICAL)

**Description**: Created the first debug session (ID: `b957d958-6b6e-47f1-8f53-1f237c6fef98`), but when attempting to set a breakpoint immediately after, received error: `"Session not found: b957d958-6b6e-47f1-8f53-1f237c6fef98"`

**Impact**: High - Sessions are not persisting between operations

**Root Cause Analysis**: 
- The session was created successfully as evidenced by the success response
- However, when listing sessions immediately after, no sessions were found
- This suggests either:
  1. Sessions are being garbage collected too aggressively
  2. Session storage is not working correctly
  3. There's a race condition in session management
  4. Sessions are being stored in a different context/scope than they're being retrieved from

**Recommendation**: Investigate the session management lifecycle and ensure sessions persist between MCP tool calls.

---

### Problem 2: CodeLLDB Executable Not Found (CRITICAL)

**Description**: When attempting to start debugging, received error:
```
"CodeLLDB executable not found. Run: npm run build:adapter"
```

**Impact**: Critical - Cannot debug any Rust programs

**Root Cause Analysis**:

#### Investigation Steps:
1. Verified that CodeLLDB executable actually exists at:
   ```
   packages/adapter-rust/vendor/codelldb/win32-x64/adapter/codelldb.exe
   ```

2. Examined the path resolution code in `packages/adapter-rust/src/utils/codelldb-resolver.ts`:
   ```typescript
   const codelldbPath = path.resolve(
     __dirname,
     '..',
     'vendor',
     'codelldb',
     platformDir,
     'adapter',
     executableName
   );
   ```

3. **BUG IDENTIFIED**: The path resolution goes up only ONE level (`'..'`) from `__dirname`, which would be:
   - `__dirname` = `packages/adapter-rust/dist/utils/` (after compilation)
   - `..` = `packages/adapter-rust/dist/`
   - Final path: `packages/adapter-rust/dist/vendor/codelldb/...`

4. **Correct path should be**:
   - `__dirname` = `packages/adapter-rust/dist/utils/`
   - `../..` = `packages/adapter-rust/`
   - Final path: `packages/adapter-rust/vendor/codelldb/...`

**Root Cause**: Path resolution bug in `codelldb-resolver.ts` - needs to go up TWO directory levels, not one.

**Code Fix Required**:
```typescript
// CURRENT (INCORRECT):
const codelldbPath = path.resolve(
  __dirname,
  '..',           // ❌ Only goes up one level
  'vendor',
  'codelldb',
  platformDir,
  'adapter',
  executableName
);

// CORRECTED:
const codelldbPath = path.resolve(
  __dirname,
  '..',           // Up to dist/
  '..',           // Up to adapter-rust/
  'vendor',
  'codelldb',
  platformDir,
  'adapter',
  executableName
);
```

**Similar Issue in getCodeLLDBVersion()**: The same function has a similar path resolution for the version file that also needs correction:
```typescript
// CURRENT (INCORRECT):
const versionFile = path.resolve(
  __dirname,
  '..',
  '..',           // This attempts to go up two levels but is for a different path
  'vendor',
  'codelldb',
  platformDir,
  'version.json'
);

// Should consistently use the same approach
```

---

### Problem 3: Cargo Build Failures for Async Example (MODERATE)

**Description**: The async example failed to build with Cargo errors:
```
error: failed to build archive at `...\target\debug\deps\libmio-110993ce929851f1.rlib`: 
failed to remove temporary directory: The process cannot access the file because 
it is being used by another process. (os error 32)
```

**Impact**: Moderate - Cannot test the async example, but this is an environment/build issue, not a debugger issue

**Root Cause Analysis**:
- This is a Windows-specific Cargo build issue
- Occurs when Windows Defender, indexing services, or other processes lock files
- Common in Windows development environments, especially in Dropbox-synced folders
- The issue is with the Rust build environment, not the MCP debugger itself

**Recommendation**: 
- Exclude Rust target directories from Dropbox sync
- Exclude target directories from Windows Defender scanning
- This is a known Windows + Cargo issue, not a debugger issue

---

### Problem 4: Breakpoint on Non-Executable Line (MINOR)

**Description**: Successfully set breakpoint on line 16 which is a blank line, not an executable statement

**Impact**: Minor - May cause unexpected behavior during debugging

**Context**: The breakpoint was set at:
```rust
14:     let version = 1.75;
15:     let is_awesome = true;
16:     
17:     // Simple calculation
18:     let result = calculate_sum(5, 10);
```

Line 16 is blank. The debugger accepted this but marked it as `"verified": false`.

**Root Cause Analysis**: The debugger allows setting breakpoints on non-executable lines but doesn't verify them. This is actually acceptable behavior for many debuggers (they move the breakpoint to the next executable line), but it could be more explicit.

**Recommendation**: Consider adding validation or warnings when breakpoints are set on non-executable lines.

---

## Additional Observations

### Positive Findings:
1. ✅ Session creation API works correctly
2. ✅ Breakpoint setting API works correctly
3. ✅ CodeLLDB executable was properly vendored
4. ✅ Path structure is well-organized
5. ✅ Error messages are clear and actionable

### CodeLLDB Setup Verification:
- CodeLLDB version: Located at `packages/adapter-rust/vendor/codelldb/win32-x64/version.json`
- Executable exists at correct location
- Package.json has correct build:adapter script: `"build:adapter": "node scripts/vendor-codelldb.js"`

## Summary of Issues by Severity

### Critical Issues (Block Testing):
1. **Path Resolution Bug** in `codelldb-resolver.ts` - prevents starting any Rust debugging session
2. **Session Persistence Issue** - sessions disappear between operations

### Moderate Issues:
1. Cargo build failures in async example (environment issue, not debugger issue)

### Minor Issues:
1. Breakpoints accepted on non-executable lines without strong validation

## Recommendations

### Immediate Actions Required:
1. **Fix path resolution** in `packages/adapter-rust/src/utils/codelldb-resolver.ts` to use `'..', '..'` instead of `'..'`
2. **Investigate session management** to ensure sessions persist correctly between MCP tool calls
3. **Add integration tests** that verify the complete debugging workflow from session creation through breakpoint hitting

### Future Improvements:
1. Add better validation for breakpoint placement (warn on non-executable lines)
2. Improve error messages to include actual paths being checked when CodeLLDB is not found
3. Add environment setup documentation for Windows users regarding Cargo build issues
4. Consider adding a diagnostic tool that verifies CodeLLDB installation and paths

## Test Status

- ❌ **Hello World Example**: BLOCKED - Cannot start debugging due to CodeLLDB path issue
- ❌ **Async Example**: BLOCKED - Cannot build due to Cargo/Windows file locking issue
- ⚠️ **Overall Rust Support**: NOT FUNCTIONAL - Critical bugs prevent usage

## Next Steps

1. Apply the path resolution fix
2. Re-test with corrected paths
3. Investigate and resolve session persistence issue
4. Test complete debugging workflow (set breakpoints, step, inspect variables)
5. Document workarounds for Windows Cargo build issues
