# .NET/C# Debugging with Debug MCP Server

The Debug MCP Server provides .NET debugging through [netcoredbg](https://github.com/Samsung/netcoredbg), Samsung's MIT-licensed .NET debugger that implements the Debug Adapter Protocol (DAP). Supports both .NET Core/.NET 5+ and .NET Framework 4.8.

## Architecture

```
MCP Client → MCP Server → SessionManager → ProxyManager → ProxyWorker
                                                              ↓
                                                    DotnetAdapterPolicy
                                                              ↓
                                                    netcoredbg-bridge (TCP↔stdio)
                                                              ↓
                                                         netcoredbg
                                                              ↓
                                                    .NET Runtime (CoreCLR or Desktop CLR)
```

The adapter uses a TCP-to-stdio bridge on all platforms to work around a netcoredbg `--server=PORT` bug (originally discovered on Windows) where the TCP connection drops after the DAP initialize sequence. The bridge spawns netcoredbg in stdio mode (which works reliably) and exposes a TCP socket for the proxy to connect to.

The proxy worker selects the `DotnetAdapterPolicy` via `DapProxyWorker.selectAdapterPolicy()`, which dispatches primarily on the session's `language` field in the init payload (through `getPolicyForLanguage()`) and only falls back to matching the adapter command shape when no language hint is provided or the language is not in the map. The policy determines .NET-specific DAP handshake behavior.

## Prerequisites

### .NET SDK

Install .NET 6+ SDK from [dotnet.microsoft.com](https://dotnet.microsoft.com/download).

Verify your installation:
```bash
dotnet --version    # Should show 6.0+ or 8.0+
```

### netcoredbg

Install netcoredbg using one of these methods:

1. **Download from releases**: [github.com/Samsung/netcoredbg/releases](https://github.com/Samsung/netcoredbg/releases)
2. **Build from source**: Clone the repo and follow their build instructions

After installation, set the `NETCOREDBG_PATH` environment variable:

```bash
# Windows (persistent)
setx NETCOREDBG_PATH "C:\path\to\netcoredbg.exe"

# Linux/macOS
export NETCOREDBG_PATH=/path/to/netcoredbg
```

Or add the netcoredbg directory to your PATH.

**Discovery order**: The adapter searches for netcoredbg in this order:
1. `NETCOREDBG_X86_PATH` environment variable (for x86 attach targets)
2. `NETCOREDBG_PATH` environment variable
3. Caller-provided preferred path (if any)
4. `which netcoredbg` (searches PATH) -- only used when no target architecture is requested, since PATH binaries have unpredictable architecture
5. Hardcoded platform-specific candidate paths
6. Recursive fallback: if an architecture-specific search found nothing, the discovery reruns without the architecture constraint

### PDB Symbol Requirements

netcoredbg only reads **Portable PDB** format. .NET Core/.NET 5+ projects generate Portable PDBs by default, so no extra steps are needed.

For .NET Framework projects, you have two options:
- Compile with `/debug:portable` (Roslyn csc)
- Let the adapter auto-convert using the bundled Pdb2Pdb tool (Windows only)

## Debugging Modes

### Launch Mode

The adapter launches the .NET program and attaches the debugger automatically.

```text
start_debugging { "sessionId": "your-session-id", "scriptPath": "/path/to/Program.cs",
                  "dapLaunchArgs": { "program": "/path/to/bin/Debug/net8.0/MyApp.dll",
                                     "cwd": "/path/to/project", "stopOnEntry": true } }
```

Key launch arguments:
- `program` (required): Path to the compiled assembly or executable (.dll or .exe), not the source file. This is the runtime target that netcoredbg will launch.
- `cwd`: Working directory for the launched process
- `stopOnEntry`: Whether to pause at the program entry point
- `args`: Command-line arguments to pass to the program

**Important**: You must compile the project first with `dotnet build` before launching the debugger. The `program` path should point to the compiled output (typically `bin/Debug/net8.0/YourApp.dll`), not to a `.cs` source file.

### Attach Mode

Connect to a running .NET process.

```text
attach_to_process { "sessionId": "your-session-id", "processId": 12345 }
```

Key attach arguments:
- `processId` (required): PID of the running .NET process
- `sourcePaths`: Directories to scan for PDB files (auto-detected from the process executable when omitted)

`stopOnEntry` and `justMyCode` are also accepted as top-level parameters; netcoredbg extras such
as `sourceFileMap` and `symbolOptions` go in `adapterConfig`.

.NET attach is **PID-only** — netcoredbg has no host/port attach, so there is no remote-attach
form of this call.

## Debugging Workflow

### 1. Create a Debug Session

```text
create_debug_session { "language": "dotnet", "name": "My .NET Debug Session" }
```

### 2. Compile the Project

```bash
dotnet build
```

### 3. Set Breakpoints

Set breakpoints before starting. Breakpoints must be on executable lines (assignments, method calls, conditionals) — not on blank lines, comments, or using directives.

```text
set_breakpoint { "sessionId": "your-session-id", "file": "/path/to/Program.cs", "line": 14 }
```

### 4. Start Debugging

```text
start_debugging { "sessionId": "your-session-id", "scriptPath": "/path/to/Program.cs",
                  "dapLaunchArgs": { "program": "/path/to/bin/Debug/net8.0/MyApp.dll",
                                     "stopOnEntry": false } }
```

### 5. Control Execution

When paused at a breakpoint:

```text
# Step over (execute current line)
step_over { "sessionId": "..." }

# Step into (enter method calls)
step_into { "sessionId": "..." }

# Step out (return from current method)
step_out { "sessionId": "..." }

# Continue (run until next breakpoint)
continue_execution { "sessionId": "..." }
```

### 6. Examine Program State

```text
# Get local variables in current frame
get_local_variables { "sessionId": "..." }

# Get call stack
get_stack_trace { "sessionId": "..." }

# Evaluate an expression
evaluate_expression { "sessionId": "...", "expression": "x + y" }
```

### 7. Close the Session

```text
close_debug_session { "sessionId": "..." }
```

## Filtered Variables

The adapter automatically filters out C# compiler-generated variables:
- `<>c__DisplayClass*` (closure classes)
- `CS$<>*` (compiler temporaries)
- `$VB$*` (VB.NET compiler variables)
- `<>t__*`, `<>s__*` (async state machine fields)

## Filtered Stack Frames

By default, stack frames are filtered to show only user code:
- Frames with no source file are hidden
- `System.*` and `Microsoft.*` runtime frames are hidden

## Example

```csharp
// Program.cs
using System;

class HelloWorld
{
    static int Add(int a, int b)
    {
        int result = a + b;   // Set breakpoint here (line 9)
        return result;
    }

    static void Main(string[] args)
    {
        Console.WriteLine("Starting...");
        int x = 10;
        int y = 20;
        int sum = Add(x, y);
        string msg = $"Sum: {sum}";
        Console.WriteLine(msg);
    }
}
```

```bash
# Create project and build
dotnet build
```

1. Create debug session with `language: "dotnet"`
2. Set breakpoint at line 9
3. Start debugging with `program: "bin/Debug/net8.0/HelloWorld.dll"`
4. When stopped at breakpoint, inspect variables: `a=10`, `b=20`

## Docker Support

.NET debugging is **disabled in Docker** (`DEBUG_MCP_DISABLE_LANGUAGES=go,dotnet`). Host-compiled Windows .NET binaries (with Windows PDB symbols) cannot be debugged inside a Linux container. The container would need the program recompiled for Linux with Portable PDB symbols, which isn't practical for the typical workflow.

## Troubleshooting

### "netcoredbg not found" error
- Set `NETCOREDBG_PATH` environment variable to the full path of the netcoredbg executable
- Or add the directory containing netcoredbg to your PATH
- On Windows, use `setx` for persistent env vars (requires shell restart)

### Empty variables list
- Ensure PDB symbols are in Portable format (default for .NET Core/.NET 5+)
- For .NET Framework, compile with `/debug:portable`
- Verify you're paused at an executable line, not a comment or using directive

### Breakpoints not firing
- Ensure the breakpoint is on an executable line
- Verify the source file matches the compiled assembly (rebuild after edits)
- Check that the PDB file is alongside the DLL

### Connection timeout
- The TCP-to-stdio bridge may take a moment to start on first use
- Check that no other process is using the bridge port

## Additional Resources

- [netcoredbg](https://github.com/Samsung/netcoredbg) — Samsung's .NET debugger
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) — DAP specification
- [.NET/C# adapter technical docs](../../packages/adapter-dotnet/docs/dotnet-adapter.md) — Internal adapter architecture
