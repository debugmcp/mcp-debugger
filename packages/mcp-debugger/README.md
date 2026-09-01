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

### Diagnose your setup
```bash
mcp-debugger doctor                # report every adapter (informational, always exits 0)
mcp-debugger doctor python go      # gate the exit code on the named languages
mcp-debugger doctor --json
```

`doctor` probes each adapter's runtime and debug backend in one pass, then prints a
verdict per language plus the fixes for anything that needs attention. Run it first
whenever a language is reported unavailable or a launch fails before your program
starts. With language arguments it exits `1` when any requested language is `broken`,
`missing`, `disabled`, or unknown (and `2` when doctor itself fails); with no arguments
it always exits `0`. `--timeout <ms>` caps each language's probe (default 10000).

See the [diagnostics guide](https://github.com/debugmcp/mcp-debugger/blob/main/docs/diagnostics.md)
for per-language prerequisites and failure signatures.

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

**Attach without a toolchain:** only **Python** (`debugpy --listen`) and **Ruby** (`rdbg --open`) attach *direct-connect* — the debug engine already runs inside the target, so the debugger host needs no Python or Ruby. JavaScript, Java, .NET and C/C++ spawn a local adapter for attach (`modes.attach: 'spawn'`) and so do need their toolchain on the debugger host — the Java JDI bridge, for instance, runs locally on the host JDK and connects out over JDWP. `list_supported_languages` reports per-mode availability with reasons.

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

### Server options (`stdio`, `sse`, `http`)
- `-l, --log-level <level>` - Set log level (error, warn, info, debug; default: info)
- `--log-file <path>` - Log to file instead of console

### SSE and HTTP options
- `-p, --port <number>` - Port for SSE or HTTP mode (default: 3001)

### `doctor` options
- `[languages...]` - Languages to check and gate the exit code on (default: report all, exit 0)
- `--json` - Emit a machine-readable report
- `--timeout <ms>` - Per-language probe timeout in milliseconds (default: 10000)

### `check-rust-binary` options
- `--json` - Emit a machine-readable report

## Documentation

See the [main repository](https://github.com/debugmcp/mcp-debugger) for full documentation.

## License

MIT
