# Ruby Debugging with mcp-debugger

mcp-debugger supports Ruby debugging through the standard `debug` gem and its `rdbg` command-line frontend. You can launch Ruby directly from MCP or attach MCP to an existing `rdbg` port.

## Prerequisites

Before using the Ruby adapter, ensure you have:

1. Ruby 2.7 or higher installed
2. The `debug` gem available in the runtime you want to debug

Ruby 3.1 and newer ship `debug` in the standard library. On older setups, install it manually:

```bash
gem install debug
```

Verify that `rdbg` is available:

```bash
rdbg --version
```

## Launch a Ruby program from MCP

### 1. Create a session

```text
use_mcp_tool(
  tool_name="create_debug_session",
  arguments={
    "language": "ruby",
    "name": "Ruby Debug Session"
  }
)
```

### 2. Set breakpoints

```text
use_mcp_tool(
  tool_name="set_breakpoint",
  arguments={
    "sessionId": "your-session-id",
    "file": "/path/to/app.rb",
    "line": 12
  }
)
```

### 3. Start debugging

For a plain Ruby script:

```text
use_mcp_tool(
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "/path/to/app.rb",
    "args": ["--verbose"]
  }
)
```

For Bundler-driven commands such as Rails, RSpec, or rake:

```text
use_mcp_tool(
  tool_name="start_debugging",
  arguments={
    "sessionId": "your-session-id",
    "scriptPath": "spec/models/user_spec.rb",
    "adapterLaunchConfig": {
      "useBundler": true,
      "bundlePath": "bundle"
    }
  }
)
```

The Ruby adapter launches `rdbg` in VS Code-compatible DAP mode and forwards the target command through `-c -- ...`.

### 4. Control execution

```text
use_mcp_tool(tool_name="step_over", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="step_into", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="step_out", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="continue_execution", arguments={ "sessionId": "your-session-id" })
use_mcp_tool(tool_name="pause_execution", arguments={ "sessionId": "your-session-id" })
```

### 5. Inspect state

Use `get_local_variables`, `get_stack_trace`, `get_scopes`, `get_variables`, and `evaluate_expression` exactly as you would in other language adapters.

## Attach to an existing `rdbg` session

Issue #46 called out the workflow where a Ruby program is already running under `rdbg` and MCP should attach to it. That flow is supported.

### 1. Start the target with `rdbg`

Plain Ruby:

```bash
rdbg --open=vscode --host 127.0.0.1 --port 12345 --nonstop -c -- ruby app.rb
```

Bundler or Rails:

```bash
rdbg --open=vscode --host 127.0.0.1 --port 12345 --nonstop -c -- bundle exec ruby app.rb
```

### 2. Create a Ruby session in MCP

```text
use_mcp_tool(
  tool_name="create_debug_session",
  arguments={
    "language": "ruby",
    "name": "Ruby Attach Session"
  }
)
```

### 3. Attach to the `rdbg` port

```text
use_mcp_tool(
  tool_name="attach_to_process",
  arguments={
    "sessionId": "your-session-id",
    "host": "127.0.0.1",
    "port": 12345,
    "sourcePaths": ["/path/to/your/project"]
  }
)
```

After the attach completes, breakpoints, stepping, stack inspection, and expression evaluation work through the existing `rdbg` session.

## Known Ruby gotcha: `pry-byebug`

Projects that load `pry-byebug` or other TracePoint-heavy debugger helpers can interfere with line breakpoints in `rdbg`.

If breakpoints appear to bind inconsistently:

1. Prefer `rdbg` as the active debugger for that run.
2. Remove `pry-byebug` from the debug execution path when possible.
3. Use an explicit source breakpoint in code when needed:

```ruby
binding.break if defined?(DEBUGGER__)
```

This is especially useful in Rails and RSpec entrypoints where other debugging gems may already be loaded.

## Tips

1. Use `useBundler: true` for Rails, RSpec, and rake-style commands so the same Gemfile context is used during debugging.
2. If `rdbg` is installed but not found, confirm the Ruby environment on your PATH matches the one that owns the gem.
3. For attach workflows, start the target with a fixed host and port so both MCP and external tools can reconnect predictably.
