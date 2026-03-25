# @debugmcp/mcp-debugger

Step-through debugging MCP server for LLMs

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
```bash
mcp-debugger sse --port 3001
```

## Batteries-Included Adapters

All language adapters are bundled into the CLI package. No separate installation is needed. The following adapters are included:

- **Python** (`@debugmcp/adapter-python`) - Python debugging via debugpy
- **JavaScript** (`@debugmcp/adapter-javascript`) - JavaScript/Node.js debugging via js-debug
- **Rust** (`@debugmcp/adapter-rust`) - Rust debugging via CodeLLDB
- **Go** (`@debugmcp/adapter-go`) - Go debugging via Delve
- **Java** (`@debugmcp/adapter-java`) - Java debugging via JDI bridge
- **.NET** (`@debugmcp/adapter-dotnet`) - .NET debugging via netcoredbg
- **Mock** (`@debugmcp/adapter-mock`) - Mock adapter for testing

**System Requirements:** Node.js 18+ is required to run mcp-debugger. You also need the language runtimes and debug tools installed on your system (e.g., Python + debugpy, Go + Delve, JDK 21+, netcoredbg with a compatible .NET runtime).

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

### SSE-only options
- `-p, --port <number>` - Port for SSE mode (default: 3001)

## Documentation

See the [main repository](https://github.com/debugmcp/mcp-debugger) for full documentation.

## License

MIT
