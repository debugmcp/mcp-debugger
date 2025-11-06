# MinimalDapClient Refactoring Progress Report

## Date: January 13, 2025

## Summary
We've successfully extended the Adapter Policy pattern to support DAP client-specific behaviors, laying the groundwork for refactoring `minimal-dap.ts` to be language-independent.

## Completed Work

### 1. ✅ Extended Policy Interface
- Added `DapClientBehavior` interface to group DAP client-specific behaviors
- Added `getDapClientBehavior()` method to `AdapterPolicy` interface
- Kept the interface clean and grouped for maintainability

### 2. ✅ Implemented DAP Client Behaviors in All Policies

#### JavaScript (JsDebugAdapterPolicy)
- Comprehensive reverse request handling for `startDebugging` and `runInTerminal`
- Child session routing configuration (20+ commands)
- Multi-session support with breakpoint mirroring
- Adapter ID normalization (`javascript` → `pwa-node`)
- Pause after attach behavior for initial stop

#### Python (PythonAdapterPolicy)
- Minimal configuration (no child sessions)
- Basic reverse request handling for `runInTerminal`
- No command routing needed

#### Mock (MockAdapterPolicy)
- Minimal configuration for testing
- No special behaviors

### 3. ✅ Created ChildSessionManager Abstraction
- Extracted complex child session logic into dedicated manager
- Handles creation, configuration, attachment, and lifecycle
- Manages breakpoint mirroring and event forwarding
- Policy-driven behavior via `DapClientBehavior`
- Clean separation of concerns

### 4. ✅ Export Structure Updated
- Added exports to `packages/shared/src/index.ts`
- Built shared package successfully
- Types are now available across the codebase

## Next Steps Required

### Phase 1: Update MinimalDapClient Constructor (30 min)
**Status: Ready to implement**

The `MinimalDapClient` constructor needs to accept an optional policy parameter:

```typescript
constructor(host: string, port: number, policy?: AdapterPolicy) {
  super();
  this.host = host;
  this.port = port;
  this.policy = policy || DefaultAdapterPolicy;
  this.dapBehavior = this.policy.getDapClientBehavior();
  
  // Initialize ChildSessionManager if policy supports child sessions
  if (this.policy.supportsReverseStartDebugging) {
    this.childSessionManager = new ChildSessionManager({
      policy: this.policy,
      parentClient: this,
      host,
      port
    });
  }
}
```

### Phase 2: Update Factory (15 min)
**Status: Ready to implement**

The factory in `dap-proxy-dependencies.ts` needs to determine and pass the policy:

```typescript
dapClientFactory: {
  create: (host: string, port: number) => {
    // Get policy from worker context (need to pass this through)
    const policy = getAdapterPolicy(); // TBD: How to get this
    return new MinimalDapClient(host, port, policy) as any;
  }
}
```

### Phase 3: Extract Reverse Request Handling (1 hour)
**Status: Ready to implement**

Replace the hardcoded switch statement in `handleProtocolMessage` with:

```typescript
if (message.type === 'request') {
  const request = message as DebugProtocol.Request;
  
  // Use policy to handle reverse requests
  if (this.dapBehavior.handleReverseRequest) {
    const context: DapClientContext = {
      sendResponse: this.sendResponse.bind(this),
      createChildSession: (config) => this.childSessionManager?.createChildSession(config),
      activeChildren: this.childSessions,
      adoptedTargets: this.adoptedTargets
    };
    
    const result = await this.dapBehavior.handleReverseRequest(request, context);
    if (result.handled) {
      if (result.createChildSession && result.childConfig) {
        await this.childSessionManager?.createChildSession(result.childConfig);
      }
      return;
    }
  }
  
  // Default response for unhandled reverse requests
  this.sendResponse(request, {});
}
```

### Phase 4: Replace Child Session Logic (1 hour)
**Status: Ready to implement**

1. Remove all child session code from MinimalDapClient (lines 492-749)
2. Replace with delegation to ChildSessionManager
3. Update command routing to use `childSessionManager.shouldRouteToChild()`
4. Update breakpoint storage to use `childSessionManager.storeBreakpoints()`

### Phase 5: Clean Up Remaining Hardcoding (30 min)
**Status: Ready to implement**

1. Remove `CHILD_ROUTED_COMMANDS` constant
2. Remove hardcoded adapter type checks
3. Remove JS-specific pause logic
4. Use policy methods for:
   - Adapter ID normalization
   - Config done deferral
   - Breakpoint mirroring decisions

## Technical Challenges

### 1. Policy Selection in Factory
**Challenge:** The factory needs access to the adapter type to select the correct policy.

**Solution Options:**
1. Pass adapter type through the connection manager
2. Store policy in worker context and access from factory
3. Make factory accept policy as parameter

**Recommended:** Option 2 - Store in worker context

### 2. Circular Dependencies
**Challenge:** MinimalDapClient and ChildSessionManager have circular dependency.

**Solution:** Use dynamic import in ChildSessionManager (already implemented)

### 3. Type Safety
**Challenge:** Ensuring type safety across the policy delegation.

**Solution:** Strong typing in DapClientBehavior interface with proper generics

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking JavaScript debugging | High | Comprehensive testing with js-debug scenarios |
| Breaking Python debugging | Medium | Test basic debugging flows |
| Performance regression | Low | Policies add minimal overhead |
| Maintenance complexity | Medium | Clear documentation and examples |

## Success Metrics

✅ **Completed:**
- Policy interface extended
- All adapters implement getDapClientBehavior()
- ChildSessionManager created
- Exports updated

⏳ **Pending:**
- No hardcoded language checks in minimal-dap.ts
- All JavaScript-specific logic in JsDebugAdapterPolicy
- Policy passed as parameter, not determined internally
- Adding new languages requires only new policy class
- Existing JavaScript and Python debugging still works

## Estimated Time to Complete

- **Completed:** ~3 hours
- **Remaining:** ~3 hours
- **Total:** ~6 hours

## Recommendations

1. **Test First:** Write tests for current JavaScript child session behavior before refactoring
2. **Incremental Migration:** Refactor one piece at a time with validation
3. **Monitor Performance:** Ensure policy delegation doesn't add significant overhead
4. **Document Patterns:** Create examples for adding new language support

## Conclusion

The foundation is solid. The policy pattern extensions are clean and well-structured. The ChildSessionManager successfully extracts complex logic. Next step is to update MinimalDapClient to use these new abstractions, which should be straightforward given the preparation work.
