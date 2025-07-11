# mcp-debugger Migration Guide

> **⚠️ DRAFT DOCUMENTATION**  
> This migration guide is based on mcp-debugger v0.10.0 architecture changes.

## Overview

Version 0.10.0 introduces a major architectural change: the transformation from a Python-specific debugger to a multi-language debugging platform using the adapter pattern. This guide helps you migrate from older versions.

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

**Backward Compatibility**: `pythonPath` is still accepted but deprecated. It will be mapped to `executablePath` internally.

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
  MOCK = 'mock',  // For testing
  // Future: NODE = 'node', GO = 'go', etc.
}
```

### Configuration Changes

#### Environment Variables

No changes to environment variables. The following still work:
- `MCP_DEBUGGER_SESSION_DIR` - Session storage directory
- `MCP_DEBUGGER_LOG_LEVEL` - Logging level
- `MCP_DEBUGGER_LOG_FILE` - Log file path

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

If you're using mcp-debugger for Python debugging, minimal changes are needed:

1. **Update parameter names** (optional):
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

2. **Register your adapter**:
   ```typescript
   import { MyLanguageAdapterFactory } from './my-language-adapter';
   
   registry.register('mylang', new MyLanguageAdapterFactory());
   ```

3. **Update language enum**:
   ```typescript
   enum DebugLanguage {
     PYTHON = 'python',
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

## Deprecation Warnings

### Deprecated in v0.10.0

1. **`pythonPath` parameter**
   - Status: Deprecated, but still functional
   - Alternative: Use `executablePath`
   - Removal: Planned for v1.0.0

2. **Python-specific error codes**
   - Status: Mapped to generic codes
   - Alternative: Use `AdapterErrorCode` enum
   - Removal: Planned for v1.0.0

### Deprecation Timeline

- **v0.10.0** (Current): Deprecation warnings added
- **v0.11.0**: Deprecation warnings become more prominent
- **v1.0.0**: Deprecated features removed

## Common Migration Issues

### Issue 1: "pythonPath is not defined"

**Problem**: TypeScript error when using old parameter name.

**Solution**: Update to `executablePath` or add type assertion:
```typescript
// Option 1: Update parameter
{ executablePath: "/usr/bin/python3" }

// Option 2: Type assertion (temporary)
{ pythonPath: "/usr/bin/python3" } as any
```

### Issue 2: "Language 'node' not supported"

**Problem**: Trying to use a language without an adapter.

**Solution**: Check supported languages first:
```typescript
const supported = await mcp.call('get_supported_languages');
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
  executablePath: '/usr/bin/python3'  // Or pythonPath for compatibility
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
console.log('Supported:', languages);  // Should include 'python', 'mock'
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
   - [Mock Adapter](../src/adapters/mock/mock-debug-adapter.ts) - Reference implementation
   - [Python Adapter](../src/adapters/python/python-debug-adapter.ts) - Production example

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
- `pythonPath` → `executablePath` (but old name still works)
- Python debugging functionality unchanged
- New adapter pattern enables multi-language support
- Deprecation warnings help you prepare for v1.0.0

Welcome to the future of multi-language debugging with mcp-debugger!
