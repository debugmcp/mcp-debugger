# Rust Debugging Examples

This directory contains example Rust projects for testing and demonstrating the MCP Debugger's Rust debugging capabilities.

## Prerequisites

1. **Rust toolchain**: Install Rust from [rustup.rs](https://rustup.rs/)
2. **CodeLLDB**: The Rust adapter will automatically download CodeLLDB when you run:
   ```bash
   cd packages/adapter-rust
   npm run build:adapter
   ```

## Example Projects

### 1. Hello World (`hello_world/`)
A simple Rust program demonstrating basic debugging features:
- Variable inspection (primitives, strings, vectors)
- Function calls and parameter inspection
- Control flow (if statements, loops)
- Breakpoint handling

**To debug:**
```bash
# Build the project
cd examples/rust/hello_world
cargo build

# Create a debug session
mcp-debugger create_debug_session --language rust

# Set a breakpoint
mcp-debugger set_breakpoint --file src/main.rs --line 10

# Start debugging
mcp-debugger start_debugging --script target/debug/hello_world
```

### 2. Async Example (`async_example/`)
Demonstrates debugging async Rust code with Tokio:
- Async/await functions
- Concurrent tasks with `tokio::spawn`
- Future inspection
- Async runtime debugging

**To debug:**
```bash
# Build the project
cd examples/rust/async_example
cargo build

# Debug similar to hello_world
```

### 3. Workspace Example (`workspace/`) - Coming Soon
Will demonstrate debugging Cargo workspaces with multiple crates.

## Debug Configurations

Each project can include a `debug_config.json` for custom launch settings:

```json
{
  "stopOnEntry": true,
  "justMyCode": false,
  "cargo": {
    "target": "debug",
    "release": false
  }
}
```

## Tips for Rust Debugging

1. **Debug vs Release builds**: 
   - Debug builds include symbols and are easier to debug
   - Use `cargo build` for debug or `cargo build --release` for optimized builds

2. **Cargo targets**:
   - Binaries: `target/debug/<binary_name>`
   - Tests: Use `cargo test` with `--no-run` to build, then debug the test executable
   - Examples: `target/debug/examples/<example_name>`

3. **Variable inspection**:
   - Rust's ownership model means variables may be moved
   - Use references (`&`) to inspect without moving
   - Collections like `Vec` and `HashMap` display nicely in the debugger

4. **Common issues**:
   - If breakpoints aren't hit, ensure you're debugging a debug build (not release)
   - Async code may require special handling for tokio runtime inspection
   - Generic functions may need concrete type instantiation to set breakpoints

## Running Tests

To test the Rust adapter with these examples:

```bash
# From the project root
pnpm test tests/integration/rust
```

## Contributing

Feel free to add more example projects that demonstrate specific Rust debugging scenarios!
