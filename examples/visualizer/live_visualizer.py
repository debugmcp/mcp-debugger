#!/usr/bin/env python3
"""
Live debugger visualizer that connects to the MCP server logs.

This module integrates the log watcher with the TUI visualizer to provide
real-time visualization of debugging sessions.
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from examples.visualizer.debug_visualizer import DebugVisualizer
from examples.visualizer.log_watcher import LogWatcher
from examples.visualizer.log_parser import LogEventParser


def main():
    """Main entry point for the live visualizer."""
    # Default log path (can be overridden by command line arg)
    log_path = sys.argv[1] if len(sys.argv) > 1 else "../../logs/debug-mcp-server.log"
    log_path = Path(log_path).resolve()
    
    print(f"MCP Debug Visualizer - Live Mode")
    print(f"================================")
    print(f"Log file: {log_path}")
    print(f"")
    print(f"Waiting for debug events...")
    print(f"Press Ctrl+C to exit")
    print(f"")
    
    # Check if log file exists or can be created
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        if not log_path.exists():
            log_path.touch()
            print(f"Created log file: {log_path}")
    except Exception as e:
        print(f"Error accessing log file: {e}")
        return 1
    
    # Create visualizer and parser
    viz = DebugVisualizer()
    parser = LogEventParser(viz.state)
    
    # Create log watcher and register callbacks
    watcher = LogWatcher(str(log_path))
    
    # Register all event handlers from the logging specification
    event_handlers = {
        'tool:call': parser.parse_tool_call,
        'tool:response': parser.parse_tool_response,
        'tool:error': parser.parse_tool_error,
        'session:created': parser.parse_session_created,
        'session:closed': parser.parse_session_closed,
        'debug:state': parser.parse_debug_state,
        'debug:breakpoint': parser.parse_debug_breakpoint,
        'debug:variables': parser.parse_debug_variables,
        'debug:output': parser.parse_debug_output,
    }
    
    # Register each handler
    for event_type, handler in event_handlers.items():
        watcher.on_event(event_type, handler)
    
    # Add some convenience handlers for events without dedicated parsers
    watcher.on_event('debug:stack_trace', 
                    lambda e: viz.state.add_tool_activity('stack_trace', 'success', 
                                                         f"Got {e.get('frameCount', 0)} frames"))
    
    watcher.on_event('debug:scopes',
                    lambda e: viz.state.add_tool_activity('scopes', 'success',
                                                         f"Got {len(e.get('scopes', []))} scopes"))
    
    try:
        # Clear old position file to start fresh
        watcher.clear_position()
        
        # Start log watching
        watcher.start()
        
        # Small delay to let watcher initialize
        import time
        time.sleep(0.5)
        
        # Run the visualizer (blocks until Ctrl+C)
        viz.run()
        
    except KeyboardInterrupt:
        print("\n\nVisualizer stopped.")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up
        watcher.stop()
        
    return 0


if __name__ == "__main__":
    sys.exit(main())
