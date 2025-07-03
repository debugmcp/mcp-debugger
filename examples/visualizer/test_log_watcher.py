#!/usr/bin/env python3
"""
Test script for the log watcher functionality.

This script demonstrates and tests the log watcher by:
1. Creating a temporary log file
2. Appending events to it
3. Verifying the watcher detects and parses them
"""
import json
import time
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from examples.visualizer.log_watcher import LogWatcher


def create_test_event(message_type: str, **kwargs) -> dict:
    """Create a test event with proper structure."""
    event = {
        "timestamp": datetime.now().isoformat() + "Z",
        "level": "info",
        "namespace": "debug-mcp:test",
        "message": message_type,
        "timestamp": int(time.time() * 1000)
    }
    event.update(kwargs)
    return event


def main():
    """Run the log watcher test."""
    # Create test log file
    test_log = Path("test_watcher.log")
    
    # Clean up any existing file
    if test_log.exists():
        test_log.unlink()
    
    print("Log Watcher Test")
    print("=" * 60)
    print(f"Log file: {test_log}")
    print()
    
    # Create log watcher
    watcher = LogWatcher(str(test_log))
    
    # Track received events
    received_events = []
    
    def event_handler(event):
        """Handle received events."""
        received_events.append(event)
        print(f"✓ Received: {event['message']} - {event.get('tool', event.get('sessionId', 'N/A'))}")
    
    # Register handlers
    for event_type in ['session:created', 'tool:call', 'tool:response', 
                       'debug:state', 'debug:variables']:
        watcher.on_event(event_type, event_handler)
    
    # Start watching
    print("Starting log watcher...")
    watcher.start()
    time.sleep(0.5)  # Let watcher initialize
    
    # Test events to append
    test_events = [
        create_test_event(
            "session:created",
            sessionId="test-session-123",
            sessionName="Test Debug Session",
            language="python"
        ),
        create_test_event(
            "tool:call",
            tool="set_breakpoint",
            sessionId="test-session-123",
            request={"file": "test.py", "line": 10}
        ),
        create_test_event(
            "tool:response",
            tool="set_breakpoint",
            sessionId="test-session-123",
            success=True,
            response={"breakpointId": "bp-1", "verified": True, "line": 10}
        ),
        create_test_event(
            "debug:state",
            event="paused",
            reason="breakpoint",
            location={"file": "test.py", "line": 10, "function": "main"}
        ),
        create_test_event(
            "debug:variables",
            variables=[
                {"name": "x", "type": "int", "value": "42"},
                {"name": "y", "type": "str", "value": "hello"}
            ],
            variableCount=2
        )
    ]
    
    # Append events one by one
    print("\nAppending test events:")
    with open(test_log, 'a') as f:
        for i, event in enumerate(test_events, 1):
            print(f"\n{i}. Writing: {event['message']}")
            json.dump(event, f)
            f.write('\n')
            f.flush()  # Ensure it's written
            
            # Wait a bit for watcher to process
            time.sleep(0.5)
    
    # Test partial line handling
    print("\n\nTesting partial line handling:")
    with open(test_log, 'a') as f:
        partial = '{"message":"tool:call","tool":"continue'
        print(f"Writing partial line: {partial}")
        f.write(partial)
        f.flush()
    
    time.sleep(0.5)
    
    # Complete the partial line
    with open(test_log, 'a') as f:
        completion = '_execution","timestamp":' + str(int(time.time() * 1000)) + '}\n'
        print(f"Completing line: ...{completion.strip()}")
        f.write(completion)
        f.flush()
    
    time.sleep(0.5)
    
    # Test malformed JSON
    print("\n\nTesting malformed JSON handling:")
    with open(test_log, 'a') as f:
        malformed = "This is not JSON\n"
        print(f"Writing malformed line: {malformed.strip()}")
        f.write(malformed)
        f.flush()
    
    time.sleep(0.5)
    
    # Summary
    print("\n" + "=" * 60)
    print(f"Test complete!")
    print(f"Events written: {len(test_events) + 1}")  # +1 for completed partial
    print(f"Events received: {len(received_events)}")
    print(f"Success rate: {len(received_events)}/{len(test_events) + 1}")
    
    # Test position persistence
    print("\n\nTesting position persistence:")
    position_before = watcher.position
    print(f"Current position: {position_before}")
    
    # Stop and restart
    watcher.stop()
    time.sleep(0.5)
    
    # Create new watcher (should resume from saved position)
    watcher2 = LogWatcher(str(test_log))
    watcher2.on_event('tool:call', lambda e: print(f"  New watcher received: {e['tool']}"))
    watcher2.start()
    
    # Append one more event
    with open(test_log, 'a') as f:
        final_event = create_test_event(
            "tool:call",
            tool="close_debug_session",
            sessionId="test-session-123"
        )
        json.dump(final_event, f)
        f.write('\n')
    
    time.sleep(0.5)
    watcher2.stop()
    
    # Clean up
    print("\n\nCleaning up...")
    test_log.unlink()
    watcher.clear_position()
    
    print("Test completed successfully!")


if __name__ == "__main__":
    main()
