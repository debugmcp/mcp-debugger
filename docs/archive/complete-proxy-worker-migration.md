# Task: Complete DAP Proxy Worker Migration to Production

## Context
The DAP Proxy Worker refactoring to use the Adapter Policy pattern is 95% complete but **not deployed**. The refactored version exists at `src/proxy/dap-proxy-worker-refactored.ts` while production still uses the old `src/proxy/dap-proxy-worker.ts`, causing 0% test coverage (326 uncovered lines).

## Current State
- ✅ **Refactored version exists** with policy pattern implemented
- ✅ **Build succeeds** with no TypeScript errors
- ❌ **Not deployed** - production uses old version
- ❌ **5 hardcoded checks remain** in refactored version
- ❌ **No test coverage** for refactored version

## Objectives
1. Complete the refactoring by removing remaining hardcoded checks
2. Deploy the refactored version to production
3. Add comprehensive test coverage
4. Achieve the targeted 7.2% overall coverage improvement

## Required Steps

### Phase 1: Complete Refactoring (30 minutes)
- [ ] Remove 5 remaining hardcoded `js-debug` checks from `dap-proxy-worker-refactored.ts`
  - Lines with `if (adapterCommand.includes('js-debug'))` 
  - Replace with policy method calls
- [ ] Ensure all language detection uses policy pattern
- [ ] Verify no direct language references remain

### Phase 2: Deploy to Production (1 hour)
- [ ] Update all imports that reference old `dap-proxy-worker.ts`
  - Check `src/proxy/proxy-manager.ts`
  - Check `src/session/` files
  - Search for all import statements: `from './dap-proxy-worker'`
- [ ] Rename files:
  - [x] ~~Keep `dap-proxy-worker-legacy.ts` as backup~~ (Removed - file was unused)
  - [ ] Move `dap-proxy-worker.ts` to `dap-proxy-worker-old.ts`
  - [ ] Move `dap-proxy-worker-refactored.ts` to `dap-proxy-worker.ts`
- [ ] Update any remaining import paths
- [ ] Run build to ensure no errors: `pnpm build`
- [ ] Run existing tests to ensure nothing breaks: `pnpm test`

### Phase 3: Add Test Coverage (2-3 hours)
Create comprehensive tests at `tests/unit/proxy/dap-proxy-worker.test.ts`:

#### Core Functionality Tests
- [ ] Test initialization with different adapter policies
- [ ] Test policy selection based on adapter command
- [ ] Test state management through policy
- [ ] Test command routing to policy methods

#### Policy Integration Tests
- [ ] Test JavaScript policy integration
  - Command queueing behavior
  - State transitions
  - Event handling
- [ ] Test Python policy integration
  - No queueing behavior
  - Direct command passing
- [ ] Test Mock policy for testing scenarios
- [ ] Test Default policy fallback

#### Error Handling Tests
- [ ] Test invalid adapter command handling
- [ ] Test policy method exceptions
- [ ] Test state corruption recovery
- [ ] Test timeout scenarios

#### Edge Cases
- [ ] Test switching between policies (should not be allowed)
- [ ] Test concurrent command handling
- [ ] Test cleanup and disposal

### Phase 4: Verify Coverage Improvement (30 minutes)
- [ ] Run coverage analysis: `pnpm test:coverage`
- [ ] Check specific file coverage: `pnpm test:coverage:analyze`
- [ ] Verify `dap-proxy-worker.ts` coverage increased from 0% to 80%+
- [ ] Confirm overall coverage increased by ~7.2%
- [ ] Document coverage improvements

### Phase 5: Final Validation (30 minutes)
- [ ] Test JavaScript debugging with real scenario
- [ ] Test Python debugging with real scenario
- [ ] Verify no regression in functionality
- [ ] Update documentation

## Success Criteria
✅ No hardcoded language checks in proxy worker  
✅ Refactored version deployed to production  
✅ Test coverage ≥80% for dap-proxy-worker.ts  
✅ Overall project coverage increased by ~7%  
✅ All existing functionality preserved  
✅ JavaScript and Python debugging still work  

## Code Locations
- **Main file**: `src/proxy/dap-proxy-worker-refactored.ts`
- ~~**Legacy backup**: `src/proxy/dap-proxy-worker-legacy.ts`~~ (Removed - was unused)
- **Current production**: `src/proxy/dap-proxy-worker.ts`
- **Import locations**: Search for `from './dap-proxy-worker'`
- **Test file to create**: `tests/unit/proxy/dap-proxy-worker.test.ts`

## Verification Commands
```bash
# Build verification
pnpm build

# Test execution
pnpm test

# Coverage analysis
pnpm test:coverage
pnpm test:coverage:analyze

# Search for remaining hardcoded checks
grep -n "js-debug" src/proxy/dap-proxy-worker-refactored.ts

# Find all imports of old proxy worker
grep -r "from './dap-proxy-worker'" src/
```

## Risk Mitigation
- ~~Keep `dap-proxy-worker-legacy.ts` as emergency rollback~~ (File removed - was unused)
- Test extensively before removing old files
- Create git commit after each phase for easy rollback
- Monitor debug sessions after deployment

## Expected Impact
- **Coverage**: From 53.8% → ~61% overall
- **Architecture**: Clean, extensible policy pattern
- **Maintainability**: Easy to add new language support
- **Technical Debt**: Eliminated language-specific hardcoding

## Notes
- The refactoring work is excellent but incomplete
- The 0% coverage mystery is solved - wrong file in production
- This migration will finally realize the benefits of the refactoring
