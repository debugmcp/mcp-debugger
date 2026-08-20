# @debugmcp/mcp-debugger

Step-through debugging MCP server for LLMs across eight languages — **28 tools** covering breakpoints (line, statement-anchored, function, logpoints), stepping, stack/variable inspection, expression evaluation, buffered program output, launch/attach/restart lifecycle, and a read-only IDE mirror of the live session.

## Installation

You can use this package without installation via npx:

```bash
npx @debugmcp/mcp-debugger stdio
```

Or install it globally:

```bash
npm install -g @debugmcp/mcp-debugger
```

## Usage

### STDIO mode (default)
```bash
mcp-debugger stdio
```

### SSE mode

> **Deprecated:** SSE transport is deprecated and will be removed in a future release. Use `mcp-debugger http --port 3001` instead.

```bash
mcp-debugger sse --port 3001
```

### HTTP mode (recommended)
```bash
mcp-debugger http --port 3001
```

## Batteries-Included Adapters

All language adapters are bundled into the CLI package. No separate installation is needed. The following adapters are included:

- **Python** (`@debugmcp/adapter-python`) - Python debugging via debugpy
- **Ruby** (`@debugmcp/adapter-ruby`) - Ruby debugging via rdbg
- **JavaScript** (`@debugmcp/adapter-javascript`) - JavaScript/Node.js debugging via js-debug
- **Rust** (`@debugmcp/adapter-rust`) - Rust debugging via CodeLLDB
- **Go** (`@debugmcp/adapter-go`) - Go debugging via Delve
- **Java** (`@debugmcp/adapter-java`) - Java debugging via JDI bridge
- **.NET** (`@debugmcp/adapter-dotnet`) - .NET debugging via netcoredbg
- **C/C++** (`@debugmcp/adapter-cpp`) - C/C++ debugging via CodeLLDB
- **Mock** (`@debugmcp/adapter-mock`) - Mock adapter for testing

**System Requirements:** Node.js 22+ is required to run mcp-debugger. Launching a program also needs that language's toolchain on the machine:

- **Python**: Python 3.7+ with `debugpy` (`pip install debugpy`)
- **Ruby**: Ruby with the `debug` gem (`rdbg`)
- **JavaScript/TypeScript**: nothing extra — js-debug is bundled
- **Rust**: the Rust toolchain (rustc/cargo; GNU toolchain on Windows). CodeLLDB itself is vendored — no system LLDB needed
- **Go**: Go + Delve (`go install github.com/go-delve/delve/cmd/dlv@latest`)
- **Java**: JDK 21+ (compile targets with `javac -g`)
- **.NET**: netcoredbg + a compatible .NET runtime (Portable PDBs)
- **C/C++**: none for prebuilt binaries (CodeLLDB vendored); a compiler (g++/clang++) only for lone-source-file launch

> **CodeLLDB platform note:** the CodeLLDB debug engine ships via per-platform optional dependencies (`@debugmcp/codelldb-<platform>`) — npm installs exactly the one matching your os/cpu, so Rust and C/C++ debugging work out of the box on Windows, macOS, and Linux. Installs with `--omit=optional` skip it; point `CODELLDB_PATH` at a [CodeLLDB](https://github.com/vadimcn/codelldb/releases) binary instead, or use the Docker image.

**Attach without a toolchain:** direct-connect attach modes (Python `debugpy --listen`, Ruby `rdbg --open`, Java JDWP) need no local language toolchain — the debug engine runs inside the target. `list_supported_languages` reports per-mode availability with reasons.

### Useful environment variables

| Variable | Effect |
|---|---|
| `DEBUG_MCP_NO_REDACT=1` | Disable default-on secret redaction in variable/evaluate/output results |
| `DEBUG_MCP_VARIABLE_ACCESS=explicit` | Least-privilege mode: `get_variables` requires explicit `names: [...]` |
| `DEBUG_MCP_BP_ADDRESSING=line\|assert\|content` | Breakpoint addressing mode (default `content`: statement anchors + content assertions) |
| `CODELLDB_PATH` | Path to a CodeLLDB binary when the platform packages are unavailable (see note above) |
| `CPP_MSVC_BEHAVIOR=warn\|error\|continue` | What to do when a C/C++ target looks MSVC-built (partial PDB fidelity) |
| `MCP_HTTP_STALE_SESSION_MS` | HTTP mode: reap crash-abandoned MCP sessions after this idle time (default 30 min) |

### Check Rust binary compatibility
```bash
mcp-debugger check-rust-binary <path-to-binary>
mcp-debugger check-rust-binary --json <path-to-binary>
```

Analyzes a Rust executable to determine whether it was built with the GNU or MSVC toolchain and reports CodeLLDB debugging compatibility. Use `--json` for machine-readable output.

## Options

### Common options (all commands)
- `--log-level <level>` - Set log level (error, warn, info, debug)
- `--log-file <path>` - Log to file instead of console

### SSE and HTTP options
- `-p, --port <number>` - Port for SSE or HTTP mode (default: 3001)

## Documentation

See the [main repository](https://github.com/debugmcp/mcp-debugger) for full documentation.

## License

MIT
