"""
Log file watcher for the MCP debugger.

This module watches the MCP debugger log file and parses events in real-time,
dispatching them to registered callbacks for visualization.
"""

import json
import time
import os
import sys
from pathlib import Path
from typing import Callable, Optional, Dict, Any
import threading
import datetime


class LogWatcher:
    """Watches the MCP debugger log file and parses events."""
    
    def __init__(self, log_path: str, polling_interval: float = 0.1):
        """
        Initialize the log watcher.
        
        Args:
            log_path: Path to the log file to watch
            polling_interval: How often to check for new data (seconds)
        """
        self.log_path = Path(log_path)
        self.polling_interval = polling_interval
        self.position = 0
        self.running = False
        self.callbacks = {}
        self.thread = None
        self.last_inode = None
        self._position_file = Path('.visualizer_position')
        
    def on_event(self, event_type: str, callback: Callable[[Dict[str, Any]], None]):
        """
        Register a callback for a specific event type.
        
        Args:
            event_type: The message type to listen for (e.g., 'tool:call')
            callback: Function to call when this event type is received
        """
        self.callbacks[event_type] = callback
        
    def parse_log_line(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Parse a JSON log line.
        
        Args:
            line: Raw log line to parse
            
        Returns:
            Parsed event data or None if invalid
        """
        line = line.strip()
        
        # Skip empty or incomplete lines
        if not line or not line.startswith('{'):
            return None
            
        try:
            data = json.loads(line)
            # Check if it's one of our structured log events
            if 'message' in data and data['message'] in self.callbacks:
                # Convert numeric timestamp to readable format if present
                if 'timestamp' in data and isinstance(data['timestamp'], (int, float)):
                    data['readable_time'] = self._format_timestamp(data['timestamp'])
                return data
        except json.JSONDecodeError:
            # Silently ignore malformed JSON
            pass
        except Exception as e:
            # Log unexpected errors without interfering with TUI
            print(f"Unexpected error parsing log line: {e}", file=sys.stderr)
            
        return None
        
    def _format_timestamp(self, timestamp: float) -> str:
        """
        Convert millisecond timestamp to readable format.
        
        Args:
            timestamp: Unix timestamp in milliseconds
            
        Returns:
            Formatted time string (HH:MM:SS.mmm)
        """
        dt = datetime.datetime.fromtimestamp(timestamp / 1000)
        return dt.strftime('%H:%M:%S.%f')[:-3]
        
    def _load_position(self) -> int:
        """Load saved file position if available."""
        try:
            if self._position_file.exists():
                return int(self._position_file.read_text().strip())
        except Exception:
            pass
        return 0
        
    def _save_position(self):
        """Save current file position for resume capability."""
        try:
            self._position_file.write_text(str(self.position))
        except Exception:
            # Silently ignore save errors
            pass
            
    def watch(self):
        """Start watching the log file (runs in thread)."""
        self.running = True
        
        # Create log file if it doesn't exist
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.log_path.exists():
            self.log_path.touch()
            
        # Load saved position if resuming
        saved_position = self._load_position()
        
        while self.running:
            try:
                # Check if file exists and get inode
                if self.log_path.exists():
                    current_inode = os.stat(self.log_path).st_ino
                    
                    # Detect file rotation
                    if self.last_inode is not None and current_inode != self.last_inode:
                        # File was rotated, reset position
                        self.position = 0
                        saved_position = 0
                    
                    self.last_inode = current_inode
                    
                    # Open and read file
                    with open(self.log_path, 'r', encoding='utf-8') as f:
                        # Seek to saved position on first open
                        if saved_position > 0:
                            try:
                                f.seek(saved_position)
                                saved_position = 0  # Only use once
                            except Exception:
                                f.seek(0, 2)  # Go to end if saved position invalid
                        else:
                            # Move to our last known position
                            f.seek(self.position)
                        
                        while self.running:
                            # Read next line
                            line = f.readline()
                            
                            if line:
                                # Check if line is complete
                                if line.endswith('\n'):
                                    # Complete line - process it
                                    event = self.parse_log_line(line)
                                    if event:
                                        event_type = event.get('message')
                                        if event_type in self.callbacks:
                                            try:
                                                self.callbacks[event_type](event)
                                            except Exception as e:
                                                print(f"Error in callback for {event_type}: {e}", 
                                                      file=sys.stderr)
                                else:
                                    # Partial line - seek back and wait
                                    f.seek(f.tell() - len(line))
                                    time.sleep(self.polling_interval / 2)
                                    continue
                                    
                                # Update position after successful read
                                self.position = f.tell()
                                self._save_position()
                            else:
                                # No new data, check for file rotation
                                try:
                                    new_inode = os.stat(self.log_path).st_ino
                                    if new_inode != self.last_inode:
                                        # File rotated, break inner loop to reopen
                                        break
                                except FileNotFoundError:
                                    # File deleted, break to wait for recreation
                                    break
                                    
                                # Sleep before checking again
                                time.sleep(self.polling_interval)
                                
                else:
                    # File doesn't exist, wait for it
                    time.sleep(0.5)
                    
            except Exception as e:
                # Handle unexpected errors gracefully
                print(f"Error watching log file: {e}", file=sys.stderr)
                time.sleep(1)  # Back off on error
                
    def start(self):
        """Start watching in a separate thread."""
        if self.thread is None or not self.thread.is_alive():
            self.thread = threading.Thread(target=self.watch, daemon=True)
            self.thread.start()
            
    def stop(self):
        """Stop watching and clean up."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
            
    def inject_event(self, event_data: Dict[str, Any]):
        """
        Inject a test event (useful for testing).
        
        Args:
            event_data: Event data to inject
        """
        if event_data.get('message') in self.callbacks:
            self.callbacks[event_data['message']](event_data)
            
    def clear_position(self):
        """Clear saved position (useful for starting fresh)."""
        try:
            if self._position_file.exists():
                self._position_file.unlink()
        except Exception:
            pass
        self.position = 0


# Example usage
if __name__ == "__main__":
    # Simple test
    def print_event(event):
        print(f"Event: {event.get('message')} - {event}")
        
    watcher = LogWatcher("../../logs/debug-mcp-server.log")
    watcher.on_event('tool:call', print_event)
    watcher.on_event('session:created', print_event)
    
    print("Watching log file... Press Ctrl+C to stop")
    watcher.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping...")
        watcher.stop()
