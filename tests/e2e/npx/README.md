# NPX Distribution E2E Tests

Tests for the npx "no-install" distribution channel using npm pack.

## What These Tests Do

1. **Build the project** - Runs `pnpm build`
2. **Create npm package** - Runs `npm pack` to create tarball
3. **Install globally** - Installs the package from tarball
4. **Test via npx** - Runs the MCP server using `npx @debugmcp/mcp-debugger`
5. **Verify all adapters work** - Tests Python, JavaScript, and Mock adapters

## Why This Is Important

The npx distribution channel is how most users will interact with mcp-debugger. These tests ensure:
- All adapters are bundled correctly ("batteries included")
- The package works without building from source
- JavaScript adapter is available (this was previously broken!)
- Bundle size stays reasonable (<10MB)

## Running the Tests

```bash
# Run all npx tests
pnpm test:e2e:npx

# Run individual language tests
npx vitest run tests/e2e/npx/npx-smoke-python.test.ts
npx vitest run tests/e2e/npx/npx-smoke-javascript.test.ts
```

## Test Files

- `npx-test-utils.ts` - Utilities for building, packing, installing, and testing
- `npx-smoke-python.test.ts` - Python debugging tests
- `npx-smoke-javascript.test.ts` - JavaScript debugging tests (critical!)

## Cross-Platform Compatibility

These tests work on Windows, Linux, and macOS without modification.

## What Gets Tested

### Package Build
✅ Project builds successfully  
✅ npm pack creates tarball  
✅ Package size is reasonable  
✅ All adapters are included in bundle

### Distribution Channel
✅ Global installation works  
✅ npx can locate and run the package  
✅ MCP server starts correctly  
✅ All tools are available

### Language Support
✅ Python adapter works  
✅ JavaScript adapter works (CRITICAL FIX)  
✅ Mock adapter works  
✅ All debugging operations function correctly

## Cleanup

Tests automatically clean up:
- MCP sessions
- Global npm installations
- Temporary files

If tests fail, you can manually clean up:
```bash
npm uninstall -g @debugmcp/mcp-debugger
