# E2E Smoke Tests

This directory contains end-to-end smoke tests that verify the MCP debugger server works correctly across different transport mechanisms and deployment scenarios.

## Test Files

### 1. `mcp-server-smoke-sse.test.ts`
- Tests SSE (Server-Sent Events) transport
- Uses dynamic port allocation to avoid conflicts
- Verifies HTTP/SSE connection and debugging workflow
- Tests spawning from different working directories

### 2. Docker smoke tests (`docker/` subdirectory)
- Tests containerized deployment across every language the image supports
- Verifies Docker setup works end-to-end
- Tests path translation (host paths to container paths), session lifecycle, core debug actions, and cleanup
- Includes a Docker availability check with graceful skip
- `docker-entrypoint.test.ts` covers the entrypoint script itself
- Per-language launch smoke: `docker-smoke-python.test.ts`, `docker-smoke-javascript.test.ts`,
  `docker-smoke-rust.test.ts`, `docker-smoke-cpp.test.ts`, `docker-smoke-cobol.test.ts` (the image
  installs `gnucobol3`, so the adapter compiles `examples/cobol/hello.cob` in-container),
  `docker-smoke-dart.test.ts` (the image carries the Dart SDK; `examples/dart/hello.dart` runs
  under `dart debug_adapter` in-container)
- Attach-mode smoke: `docker-smoke-cpp-attach.test.ts` (attach by PID) and
  `docker-smoke-ruby-attach.test.ts` (the image ships no Ruby runtime, so Ruby is attach-only)
- Shared helpers live in `docker-test-utils.ts`

### 3. `mcp-server-smoke-javascript.test.ts`
- Tests JavaScript adapter through MCP interface
- Validates known quirks:
  - Breakpoints may report "unverified" initially but still work
  - Stack trace retrieval uses `includeInternals: false` to filter out Node internal frames
  - Variable references change after steps (refresh pattern required)
- Tests core functionality: breakpoints, stepping, variables, expressions
- Multiple test scenarios including multiple breakpoints

### 4. `mcp-server-smoke-python.test.ts`
- Tests Python adapter through MCP interface
- Validates Python-specific behaviors:
  - Breakpoints are initially unverified, then verified asynchronously after the debugger connects
  - Clean stack traces without internal frames
  - Stable variable references (no refresh needed)
  - Requires absolute paths for script execution
  - Expression-only evaluation (statements rejected)
- Comprehensive test coverage including step-into operations

### 5. `mcp-server-smoke-go.test.ts`
- Tests Go adapter through MCP interface
- Validates Go-specific debugging behavior via Delve

### 6. `mcp-server-smoke-rust.test.ts`
- Tests Rust adapter through MCP interface
- Validates Rust-specific debugging behavior via CodeLLDB

### 7. `mcp-server-smoke-java.test.ts`
- Tests Java adapter through MCP interface
- Validates Java-specific debugging behavior via JDI bridge

### 8. `mcp-server-smoke-java-attach.test.ts`
- Tests Java attach mode through MCP interface
- Validates JDWP attach workflow

### 9. `mcp-server-smoke-java-evaluate.test.ts`
- Tests Java expression evaluation through MCP interface

### 10. `mcp-server-smoke-java-inner-class.test.ts`
- Tests Java inner class debugging through MCP interface

### 11. `mcp-server-smoke-dotnet.test.ts`
- Tests .NET/C# adapter through MCP interface
- Validates .NET debugging behavior via netcoredbg

### 12. `mcp-server-smoke-dart.test.ts` and `mcp-server-smoke-dart-attach.test.ts`
- Tests the Dart/Flutter adapter through the MCP interface against `examples/dart/` — the SDK's own
  `dart debug_adapter` behind the stdio bridge: launch, the `dart-test` runner (`-n <name>`), the
  exception filters, pause
- The attach variant attaches to a `dart_probe/bin/pause.dart` started with the VM service enabled
  (by service-info file / VM-service URI, never a PID)
- Both self-skip without a Dart SDK; `dart-example-utils.ts` locates the `// BP-NAME` lines by name
- `mcp-server-smoke-flutter.test.ts` covers the Flutter runners against `examples/dart/flutter_probe`
  (`flutter debug-adapter --test` for the widget test, with and without `stopOnEntry`; `flutter run`
  and an `integration_test` on the desktop device `flutter devices` lists). It self-skips without a
  Flutter SDK with a warm tool cache, and the desktop cases skip without a desktop device — on
  Linux also without a `DISPLAY`, and anywhere with `MCP_SKIP_FLUTTER_DESKTOP=1` (CI's
  `flutter-host` lane sets it and runs the widget-test cases only; `scripts/check-flutter-e2e-report.mjs`
  requires them). The helper generates the probe's platform folders with `flutter create` on
  first use
- `mcp-server-smoke-flutter-android.test.ts` runs `flutter run` and the `integration_test` on a
  booted Android emulator (`flutter emulators --launch <id>` is the opt-in; it self-skips without
  Flutter, adb or an online emulator, and with `MCP_SKIP_FLUTTER_ANDROID=1`). The helper generates
  `android/`, builds the debug APK once for the device's ABI and installs it (a warm build; `flutter
  run` stops and reinstalls on its own anyway), and before each launch stops a leftover instance
  and removes that emulator's own adb forwards. Never runs on CI

### 13. `mcp-server-smoke-javascript-sse.test.ts`
- Tests JavaScript adapter over SSE transport
- Validates SSE connection with JavaScript debugging workflow

### 14. `comprehensive-mcp-tools.test.ts`
- Comprehensive tests for all MCP tool operations
- Validates full debugging tool coverage end-to-end

### 15. `debugpy-connection.test.ts`
- Tests direct debugpy connection behavior
- Validates DAP protocol communication with debugpy

### 16. `smoke-test-utils.ts`
- Shared utilities for all smoke tests
- Common debug sequence execution
- SSE helper functions
- Cross-platform compatibility utilities

### 17. `rust-example-utils.ts`
- Shared utilities for Rust E2E tests
- Rust example project building and management

### Docker test utilities (`docker/docker-test-utils.ts`)
- Shared utilities for Docker smoke tests
- Container lifecycle management, health checks, and Docker availability detection

### 18. NPX smoke tests (`npx/` subdirectory)
- `npx-smoke-python.test.ts` - Tests Python debugging via the npx distribution
- `npx-smoke-javascript.test.ts` - Tests JavaScript debugging via the npx distribution
- `npx-smoke-rust.test.ts` - Tests Rust debugging via the npx distribution, which exercises
  CodeLLDB resolution through the per-platform `@debugmcp/codelldb-*` package
- `npx-test-utils.ts` - Shared utilities for NPX smoke tests

## Running the Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run only smoke tests
npm run test:e2e:smoke

# Run individual smoke test
npx vitest run tests/e2e/mcp-server-smoke-sse.test.ts
npx vitest run tests/e2e/docker/  # Docker smoke tests
npx vitest run tests/e2e/mcp-server-smoke-javascript.test.ts
npx vitest run tests/e2e/mcp-server-smoke-python.test.ts
npx vitest run tests/e2e/mcp-server-smoke-go.test.ts
npx vitest run tests/e2e/mcp-server-smoke-rust.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java-attach.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java-evaluate.test.ts
npx vitest run tests/e2e/mcp-server-smoke-java-inner-class.test.ts
npx vitest run tests/e2e/mcp-server-smoke-dotnet.test.ts
npx vitest run tests/e2e/mcp-server-smoke-javascript-sse.test.ts
npx vitest run tests/e2e/comprehensive-mcp-tools.test.ts
npx vitest run tests/e2e/debugpy-connection.test.ts
npx vitest run tests/e2e/npx/  # NPX smoke tests
```

## Prerequisites

### For Python Tests
- Python 3.7+ must be installed
- debugpy must be installed: `pip install debugpy`

### For Go Tests
- Go 1.18+ must be installed
- Delve debugger must be installed: `go install github.com/go-delve/delve/cmd/dlv@latest`

### For Java Tests
- JDK 21+ must be installed (`java` and `javac` on PATH, or `JAVA_HOME` set)
- Target code must be compiled with `javac -g` for variable inspection

### For .NET Tests
- .NET 6+ SDK must be installed
- netcoredbg must be installed (set `NETCOREDBG_PATH` or add to PATH)

### For Rust Tests
- Rust toolchain must be installed (rustc, cargo)
- Uses vendored CodeLLDB debug adapter (auto-downloaded during `pnpm install`)

### For Dart Tests
- Dart SDK 3.x on PATH (`dart --version`), or Flutter (`flutter` on PATH or `FLUTTER_ROOT`; its bundled Dart is used)
- `cd examples/dart/dart_probe && dart pub get` once; with the winget SDK keep the checkout out of `%LOCALAPPDATA%\Temp` (package:test cannot start from there)
- Tests skip automatically if no Dart SDK is found

### For SSE Tests
- No special requirements (uses dynamic port allocation)

### For Container Tests
- Docker must be installed and running
- Tests will skip automatically if Docker is not available

## Test Coverage

The smoke tests provide comprehensive coverage of:
1. **Transport Methods**: stdio, SSE, JavaScript-SSE, containerized stdio
2. **Language Adapters**: All 11 adapters (Python, JavaScript, Rust, Go, Java, .NET/C#, Ruby, C/C++, COBOL, Dart/Flutter, Mock)
3. **Path Resolution**: Different working directories, path translation, absolute vs relative paths
4. **Environment Handling**: Container environment variables, volume mounts
5. **Error Scenarios**: Proper cleanup on failure, detailed error logging
6. **Adapter Quirks**: Tests actual behavior, not idealized expectations

### JavaScript Adapter Coverage
- Unverified breakpoint handling
- Node internal frame filtering
- Variable reference refresh pattern
- Expression evaluation
- Source context retrieval

### Python Adapter Coverage
- Asynchronous breakpoint verification
- Clean stack traces
- Stable variable references
- Absolute path requirements
- Expression vs statement evaluation

## Key Features

- **Consistent Structure**: All tests follow the same pattern for easy maintenance
- **Robust Cleanup**: Ensures processes and containers are cleaned up even on failure
- **Detailed Logging**: Comprehensive logging for debugging test failures
- **Skip Conditions**: Graceful handling when prerequisites aren't met
- **Performance Optimized**: Docker image caching, dynamic port allocation
- **Cross-Platform**: Works on Windows, Linux, and macOS

## Troubleshooting

### SSE Test Failures
- Check if port is already in use (tests use dynamic ports to minimize this)
- Verify the server health endpoint is responding
- Check server logs for startup errors

### Container Test Failures
- Ensure Docker is installed: `docker --version`
- Check Docker is running: `docker ps`
- Verify Docker image builds successfully: `npm run docker-build`
- Check container logs (automatically captured on failure)

### Common Issues
- **Timeout errors**: Increase TEST_TIMEOUT if needed
- **Path not found**: Ensure the project is built (`npm run build`)
- **Permission errors**: May need elevated permissions for Docker
