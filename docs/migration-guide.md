# mcp-debugger Migration Guide

> **📌 UPDATED DOCUMENTATION**
> This migration guide covers changes through v0.15.0, including dynamic adapter loading and major UX improvements.

## What's New in v0.15.0

### ✅ Dynamic Adapter Loading (No Breaking Changes)
This release introduces dynamic discovery and loading of language adapters at runtime. The core no longer statically imports adapters; instead, it uses a loader/registry to import packages by convention.

- Adapters live in separate packages:
  - `@debugmcp/adapter-python`
  - `@debugmcp/adapter-javascript`
  - `@debugmcp/adapter-rust`
  - `@debugmcp/adapter-go`
  - `@debugmcp/adapter-mock`
- Adapters are treated as optional dependencies in consumers
- The core discovers and loads adapters on demand:
  - Package naming: `@debugmcp/adapter-<language>`
  - Factory class export: `<CapitalizedLanguage>AdapterFactory`
  - Default export (adapter package): `{ name: '<language>', factory: <Language>AdapterFactory }`

### 🔧 User Guidance
- Install core only:
  ```bash
  npm install @debugmcp/mcp-debugger
  ```
- Install core + Python adapter:
  ```bash
  npm install @debugmcp/mcp-debugger @debugmcp/adapter-python
  ```
- Verify availability:
  - Call the `list_supported_languages` tool (from your MCP client) to see which adapters are discoverable
  - If a language is missing, install its adapter package

### 🐳 Container Notes
- Stdout in stdio mode must be NDJSON-only; the runtime preloads a silencer that mirrors logs to `/app/logs` without altering protocol
- If you use `which` in minimal Node images, ensure `isexe` is also present (runtime dependency)

### 🧪 Backward Compatibility
- No breaking API changes from v0.14.x
- Existing tool calls continue to work; dynamic loading only changes how adapters are supplied to the core

## What's New in v0.12.0

### 🎉 Major UX Improvements (Backward Compatible)

The v0.12.0 release adds several AI-friendly features that enhance the debugging experience without breaking existing code:

1. **Path Validation**: No more cryptic crashes! File paths are now validated before operations.
   - `set_breakpoint` and `start_debugging` now validate files exist
   - Clear error messages instead of "[WinError 267]" crashes
   - Shows resolved paths and working directory context

2. **Line Context in Breakpoints**: The `set_breakpoint` response now includes an optional `context` field:
   ```json
   {
     "success": true,
     "breakpointId": "...",
     "context": {
       "lineContent": "    result = a + b",
       "surrounding": [
         { "line": 10, "content": "def add(a, b):" },
         { "line": 11, "content": "    result = a + b" },
         { "line": 12, "content": "    return result" }
       ]
     }
   }
   ```

3. **`get_source_context` Tool**: Previously unimplemented, now fully functional:
   ```json
   {
     "sessionId": "...",
     "file": "script.py",
     "line": 50,
     "linesContext": 5  // Optional, default: 5
   }
   ```

**No Migration Required**: All v0.12.0 features are additive and backward compatible. Your existing code will continue to work, and you can adopt the new features at your convenience.

## Overview (v0.10.0 Architecture Change)

The mcp-debugger has undergone a major architectural change: the transformation from a Python-specific debugger to a multi-language debugging platform using the adapter pattern. This version removes all backward compatibility with the old `pythonPath` parameter.

## What Changed

### Architecture Changes

**Before (v0.9.x)**:
- Python-specific implementation throughout
- `pythonPath` parameter in APIs
- Direct debugpy integration in core code
- Limited to Python debugging only

**After (v0.10.0)**:
- Language-agnostic core with adapters
- `executablePath` parameter (language-neutral)
- Adapter pattern for language support
- Extensible to any language with DAP support

### API Changes

#### Session Creation

**Old API**:
```json
{
  "tool": "create_debug_session",
  "arguments": {
    "language": "python",
    "pythonPath": "/usr/bin/python3",
    "name": "My Session"
  }
}
```

**New API**:
```json
{
  "tool": "create_debug_session",
  "arguments": {
    "language": "python",
    "executablePath": "/usr/bin/python3",  // Changed from pythonPath
    "name": "My Session"
  }
}
```

**⚠️ Breaking Change**: `pythonPath` is no longer supported. You must use `executablePath`.

#### Language Support

**Old**:
```typescript
enum DebugLanguage {
  PYTHON = 'python'  // Only Python
}
```

**New**:
```typescript
enum DebugLanguage {
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  RUST = 'rust',
  GO = 'go',
  MOCK = 'mock',  // For testing
}
```

### Configuration Changes

#### Environment Variables

No changes to environment variables. The following still work:
- `DEBUG_MCP_LOG_LEVEL` - Logging level (default: `info`)
- `MCP_CONTAINER` - Set to `true` in container mode (forces log path to `/app/logs/`)
- `CONSOLE_OUTPUT_SILENCED` - Set to `1` to suppress console output (auto-set in stdio mode)

#### Launch Configuration

Launch configurations remain mostly the same, but are now processed through language adapters:

```typescript
// Still works as before
{
  stopOnEntry: true,
  justMyCode: false,
  env: { "MY_VAR": "value" },
  cwd: "/path/to/project"
}
```

## Migration Steps

### For Existing Python Users

If you're using mcp-debugger for Python debugging, you **must** update your code:

1. **Update parameter names** (required):
   ```diff
   - "pythonPath": "/usr/bin/python3"
   + "executablePath": "/usr/bin/python3"
   ```
   
2. **Update type imports** (if using TypeScript):
   ```diff
   - import { PythonDebugSession } from 'mcp-debugger';
   + import { SessionInfo } from 'mcp-debugger';
   ```

3. **No changes needed for**:
   - Breakpoint setting
   - Step operations
   - Variable inspection
   - Expression evaluation

### For Tool Developers

If you've built tools on top of mcp-debugger:

1. **Update to new interfaces**:
   ```typescript
   // Old: Direct Python coupling
   class MyTool {
     private pythonPath: string;
   }
   
   // New: Language-agnostic
   class MyTool {
     private language: DebugLanguage;
     private executablePath: string;
   }
   ```

2. **Handle multiple languages**:
   ```typescript
   // Check supported languages
   const languages = sessionManager.getSupportedLanguages();
   
   // Validate before creating session
   if (!languages.includes(userLanguage)) {
     throw new Error(`Language ${userLanguage} not supported`);
   }
   ```

### For Extension Developers

If you want to add support for a new language:

1. **Create an adapter** following the [Adapter Development Guide](./architecture/adapter-development-guide.md)

2. **Register your adapter**: Adapters are now dynamically loaded by convention. Place your adapter package at `packages/adapter-<language>/` and export a factory class named `<Language>AdapterFactory`. The `AdapterLoader` will discover and register it automatically at runtime.

3. **Current language enum** (in `packages/shared/src/models/index.ts`):
   ```typescript
   enum DebugLanguage {
     PYTHON = 'python',
     JAVASCRIPT = 'javascript',
     RUST = 'rust',
     GO = 'go',
     MOCK = 'mock',
     MYLANG = 'mylang'  // Add your language
   }
   ```

## Breaking Changes

### 1. Direct Python Utils Access

**Breaking**: Direct access to Python utilities is no longer available.

**Old**:
```typescript
import { findPythonPath } from 'mcp-debugger/python-utils';
const pythonPath = await findPythonPath();
```

**New**:
```typescript
// Use adapter methods instead
const adapter = registry.create('python', config);
const executablePath = await adapter.resolveExecutablePath();
```

### 2. Session Structure Changes

**Breaking**: Session info structure has changed.

**Old**:
```typescript
interface DebugSession {
  id: string;
  pythonPath: string;
  // ...
}
```

**New**:
```typescript
interface SessionInfo {
  sessionId: string;
  language: DebugLanguage;
  name: string;
  state: SessionState;
  config: SessionConfig;
  createdAt: Date;
  proxyPort?: number;
}
```

### 3. Event Names

**Breaking**: Some internal events have changed names.

**Old**:
```typescript
sessionManager.on('pythonStarted', handler);
```

**New**:
```typescript
sessionManager.on('adapterConnected', handler);
```

## Removed Features

### Removed in Current Version

1. **`pythonPath` parameter**
   - Status: **REMOVED**
   - Alternative: Use `executablePath`
   - Migration: Required - update all references

2. **Session migration utilities**
   - Status: **REMOVED** 
   - The `session-migration.ts` file has been deleted
   - All code must use the new parameter names

3. **Backward compatibility layer**
   - Status: **REMOVED**
   - No automatic mapping from `pythonPath` to `executablePath`
   - Direct updates required

## Common Migration Issues

### Issue 1: "pythonPath is not defined"

**Problem**: TypeScript error when using old parameter name.

**Solution**: Update to `executablePath` (only option):
```typescript
// Required change
{ executablePath: "/usr/bin/python3" }

// This will NO LONGER work:
// { pythonPath: "/usr/bin/python3" }  // ❌ ERROR
```

### Issue 2: "Language 'node' not supported"

**Problem**: Trying to use a language without an adapter.

**Solution**: Check supported languages first:
```typescript
const supported = await mcp.call('list_supported_languages');
if (!supported.includes('node')) {
  console.log('Node.js debugging not yet available');
}
```

### Issue 3: Import errors

**Problem**: Imports fail after upgrade.

**Solution**: Update import paths:
```typescript
// Old
import { PythonDebugger } from 'mcp-debugger/lib/python';

// New
import { SessionManager } from 'mcp-debugger';
```

## Testing Your Migration

### 1. Basic Smoke Test

```typescript
// Test that existing Python debugging still works
const session = await mcp.createDebugSession({
  language: 'python',
  executablePath: '/usr/bin/python3'  // MUST use executablePath
});

await mcp.startDebugging({
  sessionId: session.sessionId,
  script: 'test.py'
});

// Should work exactly as before
```

### 2. Adapter Verification

```typescript
// Verify adapter is being used
const languages = await mcp.getSupportedLanguages();
console.log('Supported:', languages);  // Should include 'python', 'javascript', 'rust', 'go', 'mock'
```

### 3. Event Handling Test

```typescript
// Test that events still fire correctly
sessionManager.on('stopped', (event) => {
  console.log('Still works:', event);
});
```

## Getting Help

### Resources

1. **Documentation**:
   - [Architecture Overview](./architecture/README.md)
   - [API Reference](./architecture/api-reference.md)
   - [Adapter Development Guide](./architecture/adapter-development-guide.md)

2. **Examples**:
   - [Mock Adapter](../packages/adapter-mock/src/mock-debug-adapter.ts) - Reference implementation
   - [Python Adapter](../packages/adapter-python/src/python-debug-adapter.ts) - Production example

3. **Support**:
   - GitHub Issues: Report migration problems
   - Discussions: Ask questions about the new architecture

### Migration Checklist

- [ ] Update `pythonPath` to `executablePath` in API calls
- [ ] Update TypeScript imports if using types directly  
- [ ] Test existing Python debugging functionality
- [ ] Review breaking changes section
- [ ] Update any custom error handling
- [ ] Test with your specific use cases
- [ ] Plan for deprecated feature removal

## Future Compatibility

### Preparing for v1.0.0

To ensure smooth upgrades to v1.0.0:

1. **Stop using deprecated features** as soon as possible
2. **Use language-agnostic APIs** instead of Python-specific ones
3. **Test with deprecation warnings enabled**
4. **Follow the adapter pattern** for any custom extensions

### Adding New Languages

The new architecture makes it easy to add language support:

1. Implement `IDebugAdapter` interface
2. Register with `AdapterRegistry`
3. No core changes needed!

See the [Adapter Development Guide](./architecture/adapter-development-guide.md) for details.

## Summary

The v0.10.0 migration is designed to be smooth for existing Python users while opening the door for multi-language support. Most code will continue to work with minimal changes, and the deprecation timeline gives you plenty of time to update.

Key takeaways:
- `pythonPath` → `executablePath` (old name no longer works - update required)
- Python debugging functionality unchanged
- New adapter pattern enables multi-language support
- Clean architecture without backward compatibility baggage

Welcome to the future of multi-language debugging with mcp-debugger!
