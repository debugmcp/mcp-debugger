# Rust Debugging Guide

This guide covers Rust debugging support in the MCP Debugger using the CodeLLDB debug adapter.

## Prerequisites

### 1. Rust Toolchain
Install Rust from [rustup.rs](https://rustup.rs/):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. CodeLLDB (Automatic)
The Rust adapter automatically downloads CodeLLDB when you build it:
```bash
cd packages/adapter-rust
npm run build:adapter  # Downloads and extracts CodeLLDB
```

## CodeLLDB Vendoring

The Rust adapter bundles the CodeLLDB binaries into `packages/adapter-rust/vendor/codelldb`. Vendoring runs automatically when you install or build the workspace:

- `pnpm install` (postinstall hook)
- `pnpm vendor` or `pnpm vendor:adapters`
- `pnpm --filter @debugmcp/adapter-rust run build:adapter`
- `node packages/adapter-rust/scripts/vendor-codelldb.js`

> **New default:** the vendoring script now downloads **all supported platforms** (win32-x64, linux-{x86_64,arm64}, darwin-{x64,arm64}) so Docker builds can reuse the same artifacts. Set `CODELLDB_VENDOR_ALL=false` if you only want the host platform.

### Manual control

```bash
# Force a fresh download for the current platform
pnpm vendor:force

# Skip vendoring temporarily (for air-gapped dev shells)
SKIP_ADAPTER_VENDOR=true pnpm install
```

### Useful environment flags

- `CODELLDB_VERSION`: override the release tag (defaults to `1.11.0`)
- `CODELLDB_FORCE_REBUILD=true`: ignore cached binaries and re-download
- `CODELLDB_PLATFORMS=win32-x64,linux-x64`: vendor specific platforms
- `CODELLDB_VENDOR_ALL=false`: opt out of the "vendor every platform" default and fall back to host-only downloads
- `CODELLDB_VENDOR_LOCAL_ONLY=true`: disable network downloads entirely and fail if the requested platform isn't already vendored (used by Docker builds that copy pre-fetched artifacts)
- `CODELLDB_KEEP_TEMP=true`: retain the downloaded VSIX and extracted temp folders for inspection
- `SKIP_ADAPTER_VENDOR=true`: opt out entirely (used by CI jobs that pre-bake artifacts)

### Troubleshooting vendoring

1. Run `pnpm vendor:status` to see which adapters are ready for the current machine.
2. Re-run `pnpm --filter @debugmcp/adapter-rust run build:adapter` and check the `[CodeLLDB vendor]` logs:
   - `HTTP response: ...` confirms GitHub access.
   - `Artifact magic header: 504b0304 (PK..)` verifies a valid VSIX download.
3. If you see `Failed to vendor`, re-run with `CODELLDB_KEEP_TEMP=true` to inspect the downloaded file under `packages/adapter-rust/vendor/codelldb/temp`.
4. Network errors or 404 responses usually indicate a typo in `CODELLDB_VERSION` or a transient GitHub outage—try again with `pnpm vendor:force`.
5. On Windows, ensure PowerShell is allowed to create executables in the workspace (no antivirus quarantine).

## Features

### Supported Capabilities

- ✅ **Breakpoints**: Set breakpoints in Rust source files
- ✅ **Stepping**: Step over, into, and out of functions
- ✅ **Variable inspection**: View local variables, including complex types
- ✅ **Stack traces**: Full call stack with Rust symbols
- ✅ **Cargo integration**: Debug Cargo projects directly
- ✅ **Debug/Release builds**: Support for both build configurations
- ✅ **Async debugging**: Debug tokio and async-std applications

### Rust-Specific Features

1. **Smart Type Display**: Collections like `Vec`, `HashMap`, and `String` are displayed in a readable format
2. **Ownership Tracking**: See borrowed vs owned values
3. **Pattern Matching**: Step through match expressions
4. **Macro Expansion**: Debug through macro-generated code

## Quick Start

### 1. Create a Debug Session

```json
{
  "tool": "create_debug_session",
  "arguments": {
    "language": "rust",
    "name": "My Rust Debug Session"
  }
}
```

### 2. Build Your Rust Project

```bash
# For debug build (recommended for debugging)
cargo build

# For release build (optimized, harder to debug)
cargo build --release
```

### 3. Set Breakpoints

```json
{
  "tool": "set_breakpoint",
  "arguments": {
    "sessionId": "your-session-id",
    "file": "src/main.rs",
    "line": 10
  }
}
```

### 4. Start Debugging

For a simple binary:
```json
{
  "tool": "start_debugging",
  "arguments": {
    "sessionId": "your-session-id",
    "scriptPath": "target/debug/my_program"
  }
}
```

For a Cargo project with arguments:
```json
{
  "tool": "start_debugging",
  "arguments": {
    "sessionId": "your-session-id",
    "scriptPath": "target/debug/my_program",
    "args": ["--verbose", "input.txt"],
    "dapLaunchArgs": {
      "cargo": {
        "target": "debug",
        "args": ["arg1", "arg2"]
      }
    }
  }
}
```

### 5. Understand What the Rust Example Helper Does

Our test suite uses `tests/e2e/rust-example-utils.ts` to make sure every rust smoke test compiles and reuses binaries deterministically. The helper does three things you can mirror in your own workflows:

1. **Build with the GNU toolchain when available.** On Windows it looks up `dlltool.exe` (via `@debugmcp/adapter-rust`’s `findDlltoolExecutable`) and runs `cargo +stable-gnu build --target x86_64-pc-windows-gnu`. If that fails it falls back to the platform’s default triple (MSVC on Windows, glibc or musl elsewhere). You can follow the same pattern manually:
   ```powershell
   # GNU-preferred build on Windows
   rustup target add x86_64-pc-windows-gnu
   cargo +stable-gnu build --target x86_64-pc-windows-gnu
   ```
   ```bash
   # Non-Windows hosts usually only need the default debug build
   cargo build
   ```
2. **Resolve the correct binary path for `start_debugging`.** Breakpoints should always reference the `.rs` source file (absolute paths avoid MCP resolution issues), but `start_debugging.scriptPath` must point to the compiled artifact:
   - Windows GNU: `examples/rust/<name>/target/x86_64-pc-windows-gnu/debug/<name>.exe`
   - Windows MSVC fallback: `examples/rust/<name>/target/debug/<name>.exe`
   - Unix-like hosts: `examples/rust/<name>/target/debug/<name>`

   Tokio/async builds use exactly the same rule—the helper’s `prepareRustExample('async_example')` just compiles a different crate and returns `{ sourcePath, binaryPath }` so the smoke tests can reuse those paths.
3. **Cache builds between tests.** Once an example has been compiled, the helper stores both paths in-memory so the rest of the suite can run without triggering another `cargo build`. For local work you can emulate this with Cargo’s default incremental builds: as long as you relaunch the same `target/<triple>/debug/<binary>` the MCP `start_debugging` call does not care when the binary was produced.

> **Tip:** Users can reuse the same helper logic by importing `prepareRustExample` inside custom E2E scripts, or by replicating its approach in their own build tooling. The important detail is that breakpoints reference source (`src/main.rs`) while `start_debugging.scriptPath` references the compiled executable. This is true for synchronous and async (Tokio) binaries alike.

## Cargo Integration

The Rust adapter provides special support for Cargo projects:

### Debug Configuration

```json
{
  "dapLaunchArgs": {
    "cargo": {
      "target": "debug",      // or "release"
      "args": ["--help"],     // Program arguments
      "env": {                // Environment variables
        "RUST_LOG": "debug"
      }
    }
  }
}
```

### Workspace Support

For Cargo workspaces with multiple packages:
```json
{
  "dapLaunchArgs": {
    "cargo": {
      "target": "debug",
      "package": "my-crate"  // Specify which crate to debug
    }
  }
}
```

## Common Debugging Scenarios

### 1. Debug a Unit Test

```bash
# Build the test executable
cargo test --no-run

# Find the test executable (usually in target/debug/deps/)
ls target/debug/deps/*-*

# Debug it
```

```json
{
  "tool": "start_debugging",
  "arguments": {
    "sessionId": "your-session-id",
    "scriptPath": "target/debug/deps/my_crate-abc123def456",
    "args": ["test_name", "--nocapture"]
  }
}
```

### 2. Debug with Environment Variables

```json
{
  "tool": "start_debugging",
  "arguments": {
    "sessionId": "your-session-id",
    "scriptPath": "target/debug/my_program",
    "dapLaunchArgs": {
      "env": {
        "RUST_BACKTRACE": "1",
        "RUST_LOG": "debug",
        "DATABASE_URL": "postgres://localhost/mydb"
      }
    }
  }
}
```

### 3. Debug Async Code

When debugging async Rust code with tokio:

```rust
#[tokio::main]
async fn main() {
    // Set breakpoint here to debug async initialization
    let runtime = tokio::runtime::Runtime::new().unwrap();
    
    runtime.block_on(async {
        // Your async code here
        my_async_function().await;
    });
}
```

### 4. Inspect Complex Types

```json
{
  "tool": "get_variables",
  "arguments": {
    "sessionId": "your-session-id",
    "scope": 5  // Local scope reference
  }
}
```

Response will show Rust types clearly:
```json
{
  "variables": [
    {"name": "my_vec", "value": "[1, 2, 3, 4, 5]", "type": "Vec<i32>"},
    {"name": "my_string", "value": "\"Hello, Rust!\"", "type": "String"},
    {"name": "my_option", "value": "Some(42)", "type": "Option<i32>"},
    {"name": "my_result", "value": "Ok(\"success\")", "type": "Result<&str, Error>"}
  ]
}
```

## Troubleshooting

### Breakpoints Not Hit

1. **Ensure debug symbols are included**:
   - Use debug builds (`cargo build`) not release
   - Or add debug symbols to release: 
     ```toml
     [profile.release]
     debug = true
     ```

2. **Check optimization level**:
   - Optimizations can prevent breakpoints
   - Use `opt-level = 0` for debugging

3. **Verify file paths**:
   - Use absolute paths or paths relative to workspace root
   - Ensure the file exists and matches the compiled code

### Variables Show as Optimized Out

This happens in release builds or with optimizations enabled:
```toml
[profile.dev]
opt-level = 0  # No optimization for better debugging
```

### Can't Find CodeLLDB

If CodeLLDB is not found:
```bash
# Re-run the vendor script
cd packages/adapter-rust
npm run build:adapter

# Check if it was downloaded
ls vendor/codelldb*/
```

### Async Code Debugging Issues

- Use `tokio::time::sleep` instead of `std::thread::sleep` in async contexts
- Set breakpoints inside async blocks, not on the `async fn` declaration
- Use `.await` points as natural breakpoint locations

## Performance Tips

1. **Use debug builds for development**: They're slower but much easier to debug
2. **Limit scope of debugging**: Use conditional breakpoints to avoid stopping too often
3. **Use logging**: Combine debugging with `env_logger` or `tracing` for better insights
4. **Profile before optimizing**: Use `cargo flamegraph` or `perf` to find bottlenecks

## Advanced Features

### Conditional Breakpoints

```json
{
  "tool": "set_breakpoint",
  "arguments": {
    "sessionId": "your-session-id",
    "file": "src/main.rs",
    "line": 42,
    "condition": "counter > 100"
  }
}
```

### Expression Evaluation

Coming soon - evaluate Rust expressions in the current context:
```json
{
  "tool": "evaluate_expression",
  "arguments": {
    "sessionId": "your-session-id",
    "expression": "my_vec.len()"
  }
}
```

## Examples

See the `examples/rust/` directory for complete examples:
- `hello_world/`: Basic Rust debugging
- `async_example/`: Async/await with Tokio
- More examples coming soon!

## Known Limitations

1. **Macro debugging**: Stepping through macros can be confusing due to expansion
2. **Inline functions**: May not have breakpoint locations
3. **Generic functions**: Need concrete instantiation for breakpoints
4. **Async stack traces**: Can be deep due to runtime machinery

## Resources

- [CodeLLDB Documentation](https://github.com/vadimcn/vscode-lldb)
- [Rust Debugging Book](https://rustc-dev-guide.rust-lang.org/debugging.html)
- [Cargo Documentation](https://doc.rust-lang.org/cargo/)
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)
