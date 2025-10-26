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

## Optional Adapters

To debug specific languages, install the corresponding adapter packages:

```bash
# Python debugging support
npm install -g @debugmcp/adapter-python

# Mock adapter for testing
npm install -g @debugmcp/adapter-mock
```

## Options

- `--log-level <level>` - Set log level (error, warn, info, debug)
- `--log-file <path>` - Log to file instead of console
- `--port <number>` - Port for SSE mode (default: 3001)

## Documentation

See the [main repository](https://github.com/debugmcp/mcp-debugger) for full documentation.

## License

MIT
