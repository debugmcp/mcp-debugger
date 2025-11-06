# JavaScript Adapter Development - Lessons Learned

This document captures critical technical insights from developing the JavaScript/TypeScript debug adapter. These lessons are essential for anyone continuing work on this adapter or developing new adapters.

---

## 1. IPv6/IPv4 Transport Issue (CRITICAL)

### The Problem
The JavaScript adapter was experiencing consistent `ECONNREFUSED` errors when attempting to connect to the js-debug adapter, even though the adapter process was running successfully.

### Root Cause
- **js-debug listens on IPv6 by default**: The js-debug adapter binds to `::1` (IPv6 localhost)
- **Proxy was connecting to IPv4**: The proxy configuration used `127.0.0.1` (IPv4 localhost)
- **Result**: Connection attempts failed because IPv4 and IPv6 addresses are not interchangeable

### The Solution
Changed `adapterHost` from `'127.0.0.1'` to `'localhost'` in the session manager.

**Files Modified:**
- `src/session/session-manager-operations.ts` (2 locations in the file)

**Why This Works:**
- The hostname `'localhost'` resolves to BOTH IPv4 (`127.0.0.1`) and IPv6 (`::1`)
- Node.js networking stack tries both address families automatically
- This ensures compatibility regardless of which address family the debug adapter prefers

### Verification
Created `tests/manual/test-jsdebug-transport.js` to verify:
- ✅ js-debug successfully binds to a port
- ✅ Connection succeeds using `localhost`
- ✅ TCP mode works with IPv6

### Key Takeaway
**Always use `'localhost'` instead of `'127.0.0.1'` when connecting to debug adapters.** This ensures compatibility with adapters that may prefer IPv6 (like js-debug) or IPv4 (like debugpy).

---

## 2. TCP Transport Requirement (ARCHITECTURE)

### The Finding
The js-debug adapter **only supports TCP transport mode**. It does NOT support stdio communication.

### Command Syntax
js-debug uses **positional argument syntax** for TCP mode:
```typescript
// Correct syntax for js-debug
const args = [adapterPath, String(port)];
// Example: ['vendor/js-debug/vsDebugServer.cjs', '5678']
```

**NOT:**
```typescript
// These DO NOT work with js-debug
const args = [adapterPath, '--stdio'];           // ❌ No stdio support
const args = [adapterPath, '--server', port];    // ❌ Wrong flag syntax
const args = [adapterPath, `--port=${port}`];    // ❌ Wrong flag syntax
```

### Why js-debug Doesn't Support stdio
js-debug is architecturally designed as a TCP server. The underlying debug adapter:
1. Always allocates a TCP port
2. Listens for incoming DAP connections on that port
3. Does not have code paths for stdio-based communication

Attempting to use `--stdio` or similar flags will cause the adapter to fail or ignore the flag.

### Implementation Requirements

**In the Adapter (`buildAdapterCommand`):**
```typescript
buildAdapterCommand(config: AdapterConfig): AdapterCommand {
  const port = config.adapterPort;
  
  // Validate port - proxy infrastructure requires valid TCP port
  if (!port || port === 0) {
    throw new AdapterError(
      `Valid TCP port required for JavaScript adapter. Port was: ${port}`,
      AdapterErrorCode.ENVIRONMENT_INVALID
    );
  }

  // Use positional port argument
  const args = [adapterPath, String(port)];
  
  return { command: nodePath, args, env };
}
```

**In the Session Manager:**
```typescript
// Must use localhost (not 127.0.0.1) and provide valid port
await proxyManager.start({
  sessionId,
  language: DebugLanguage.JAVASCRIPT,
  adapterHost: 'localhost',  // Not '127.0.0.1'!
  adapterPort: allocatedPort, // Must be > 0
  // ...
});
```

### Proxy Validation
The ProxyManager validates the transport configuration:
- Rejects `adapterPort === 0` or `undefined`
- Requires explicit TCP configuration
- Does not have a stdio fallback for js-debug

### Comparison with Other Adapters

| Adapter | Transport | Syntax |
|---------|-----------|--------|
| **JavaScript (js-debug)** | TCP only | `[path, String(port)]` |
| **Python (debugpy)** | TCP preferred | `['--listen', 'host:port']` |
| **Mock** | Both | Configurable for testing |

### Key Takeaway
**The JavaScript adapter MUST use TCP transport.** This is not a configuration option but an architectural requirement of js-debug. Any future work on this adapter must maintain TCP mode.

---

## Diagnostic Tools

### Manual Transport Test
Use `tests/manual/test-jsdebug-transport.js` to verify transport configuration:
```bash
node tests/manual/test-jsdebug-transport.js
```

This test:
- Spawns js-debug with TCP configuration
- Verifies it listens on the specified port
- Confirms IPv6 compatibility
- Tests connection establishment

### Debugging Connection Issues
If experiencing connection failures:

1. **Check the host configuration:**
   ```typescript
   // Bad
   adapterHost: '127.0.0.1'
   
   // Good
   adapterHost: 'localhost'
   ```

2. **Verify port configuration:**
   ```typescript
   // Port must be a positive integer
   if (!adapterPort || adapterPort === 0) {
     // This will fail!
   }
   ```

3. **Review adapter command:**
   ```typescript
   // Should be positional argument
   args: [adapterPath, String(port)]
   ```

4. **Check logs:**
   - Look for `ECONNREFUSED` → likely IPv4/IPv6 mismatch
   - Look for `invalid port` → port validation issue
   - Look for adapter startup errors → check vendoring

---

## Future Adapter Development

When developing adapters for other debug protocols:

1. **Always check transport support:** 
   - Does the adapter support stdio?
   - Does it support TCP?
   - What is the command-line syntax?

2. **Use localhost for networking:**
   - Don't hard-code `127.0.0.1`
   - Let the OS resolve to appropriate address family

3. **Test with actual debug adapter:**
   - Don't assume based on documentation
   - Create manual test scripts to verify

4. **Document transport requirements:**
   - Be explicit about TCP vs stdio
   - Document exact command syntax
   - Include working examples

---

## References

- Issue thread: IPv6/IPv4 transport mismatch discovery
- Test file: `tests/manual/test-jsdebug-transport.js`
- Code changes: `src/session/session-manager-operations.ts`
- Adapter implementation: `packages/adapter-javascript/src/javascript-debug-adapter.ts`

---

**Last Updated:** October 1, 2025  
**Version:** JavaScript Adapter v0.1.0
