# examples/visualizer/live_visualizer.py
@source-hash: 2e76aa790b21ae62
@generated: 2026-02-09T18:14:56Z

## Primary Purpose
Live visualization entry point that connects MCP server debug logs to a real-time TUI visualizer. Orchestrates log watching, event parsing, and visualization components to provide live debugging session monitoring.

## Key Components

**main() (L20-101)** - Main entry point that:
- Accepts optional log file path via command line argument (default: "../../logs/debug-mcp-server.log")
- Creates/validates log file and directory structure
- Initializes DebugVisualizer and LogEventParser components
- Sets up comprehensive event handler mapping for all debug event types
- Manages application lifecycle with proper cleanup on exit

**Event Handler Registry (L52-66)** - Maps debug event types to parser methods:
- Tool events: `tool:call`, `tool:response`, `tool:error`
- Session events: `session:created`, `session:closed` 
- Debug events: `debug:state`, `debug:breakpoint`, `debug:variables`, `debug:output`

**Convenience Handlers (L69-75)** - Lambda functions for events without dedicated parsers:
- `debug:stack_trace` - Reports frame count to tool activity
- `debug:scopes` - Reports scope count to tool activity

## Dependencies
- **DebugVisualizer** (L15): TUI component for real-time visualization
- **LogWatcher** (L16): File monitoring for log changes  
- **LogEventParser** (L17): Structured log event parsing

## Architecture Patterns
- **Observer Pattern**: LogWatcher notifies registered event handlers
- **Component Integration**: Bridges three separate modules (watcher, parser, visualizer)
- **Graceful Lifecycle**: Proper initialization, cleanup on interruption/error

## Critical Behaviors
- Creates log file/directory if missing (L36-39)
- Clears watcher position to start fresh each run (L79)
- Blocks on visualizer.run() until user interruption (L89)
- Ensures watcher cleanup in finally block (L99)