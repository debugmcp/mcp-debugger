# Task: Fix JavaScript Adapter Integration Test Assertions

## Context

The JavaScript debug adapter was recently switched from stdio transport to TCP transport. The adapter package unit tests were successfully updated, but integration tests in `tests/adapters/javascript/integration/` still have outdated assertions expecting the old transport mechanism.

## Background: Port Allocation

### Production Code
Production uses **dynamic port allocation** via `NetworkManagerImpl.findFreePort()`:
```typescript
// src/implementations/network-manager-impl.ts
async findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {  // Port 0 = OS assigns any available port
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
```

Called in `SessionManagerOperations.startProxyManager()`:
```typescript
const adapterPort = await this.findFreePort();  // Dynamically allocated
```

### Test Code
Integration tests use **hardcoded ports** for predictability:
- `javascript-session-smoke.test.ts`: `56789`
- `javascript-proxy-dap-forwarding.test.ts`: `45678`  
- `javascript-proxy-startup.test.ts`: `34567`

This is **intentional and correct** - tests don't need dynamic allocation, they're testing the plumbing with known values.

## Problems to Fix

### Issue 1: File Extension Mismatches
Tests check for `vsDebugServer.js` but implementation uses `vsDebugServer.cjs`:

```typescript
// WRONG (in tests):
expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.js')).toBe(true);

// CORRECT (what implementation returns):
const adapterPath = path.resolve(__dirname, '../vendor/js-debug/vsDebugServer.cjs');
```

### Issue 2: Transport Mechanism Assertions
Tests expect `--stdio` but implementation now uses TCP with port as second argument:

```typescript
// WRONG (in tests):
expect(cmd.args?.[1]).toBe('--stdio');

// CORRECT (what implementation returns):
// args = [adapterPath, String(adapterPort)]
expect(cmd.args?.[1]).toBe(String(adapterPort));
```

## Files to Fix

### 1. `tests/adapters/javascript/integration/javascript-session-smoke.test.ts`

**Lines 80-81** - Fix both assertions:

```typescript
// CURRENT (WRONG):
expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.js')).toBe(true);
expect(cmd.args?.[1]).toBe('--stdio');

// CHANGE TO:
expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.cjs')).toBe(true);
expect(cmd.args?.[1]).toBe(String(56789));  // Match the hardcoded adapterPort
```

### 2. `tests/adapters/javascript/integration/javascript-proxy-startup.test.ts`

**Lines 147-148** - Fix both assertions:

```typescript
// CURRENT (WRONG):
expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.js')).toBe(true);
expect(cmd.args[1]).toBe('--stdio');

// CHANGE TO:
expect(adapterPath.endsWith('/vendor/js-debug/vsDebugServer.cjs')).toBe(true);
expect(cmd.args[1]).toBe(String(34567));  // Match the hardcoded adapterPort
```

### 3. `tests/adapters/javascript/integration/javascript-proxy-dap-forwarding.test.ts`

**No assertion changes needed** - This test doesn't assert on adapter command structure. It uses `FakeProxyProcessLauncher` and should pass once the other tests are fixed.

## Implementation Notes

1. **Use `replace_in_file` tool** for surgical changes - these are single-line fixes
2. **Port numbers must match** the `adapterPort` constant defined earlier in each test file
3. **Order matters** in `replace_in_file` - fix line 80/147 before line 81/148 (order they appear in file)

## Verification

After fixes, run:
```bash
pnpm test tests/adapters/javascript/integration
```

**Expected**: All 3 integration tests should pass.

## Success Criteria

✅ File extension checks use `.cjs` instead of `.js`
✅ Transport checks expect TCP port numbers instead of `--stdio`
✅ Port numbers in assertions match the hardcoded `adapterPort` values
✅ All integration tests pass
✅ No regressions in other tests
