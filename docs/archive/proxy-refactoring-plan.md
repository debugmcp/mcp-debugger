# DAP Proxy Worker Refactoring Plan

## Objective
Refactor `src/proxy/dap-proxy-worker.ts` to use the Adapter Policy pattern, removing all language-specific hardcoding.

## Current Issues
- 6 JavaScript-specific fields hardcoded in proxy worker
- Conditional logic scattered throughout
- Violates Open/Closed Principle
- 326 uncovered lines (0% test coverage)

## Implementation Plan

### Phase 0: Safety Net
- Create backup of current implementation
- Set up feature flag for gradual rollout
- Prepare parallel testing infrastructure

### Phase 1: Interface Design
Extend `AdapterPolicy` with specific methods for command handling and state management.

### Phase 2: Policy Implementation
Implement new methods in existing policies without using them yet.

### Phase 3: Testing Infrastructure
Write comprehensive tests for new policy methods before integration.

### Phase 4: Proxy Worker Refactoring
Refactor proxy worker to use policies (behind feature flag).

### Phase 5: Parallel Testing
Run both implementations in parallel to ensure compatibility.

### Phase 6: Cleanup
Remove legacy code once confident in new implementation.

## Success Metrics
- No language-specific code in proxy worker
- Test coverage > 80% for proxy worker
- All existing tests pass
- Performance remains the same or better
