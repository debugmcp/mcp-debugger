"""
Log event parser for the MCP debugger visualizer.

This module parses structured log events and updates the visualizer state
according to the logging specification.
"""

from typing import Dict, Any, Optional, List
from pathlib import Path
import os
import datetime

from .state import DebugState, CodeLocation


class LogEventParser:
    """Parses log events and updates visualizer state."""
    
    def __init__(self, state: DebugState):
        """
        Initialize the parser with a state reference.
        
        Args:
            state: The DebugState instance to update
        """
        self.state = state
        
    def parse_tool_call(self, event: Dict[str, Any]):
        """
        Handle tool:call events.
        
        Expected event structure:
        {
            "message": "tool:call",
            "tool": "set_breakpoint",
            "sessionId": "abc-123",
            "request": { ... }
        }
        """
        tool = event.get('tool', 'unknown')
        request = event.get('request', {})
        
        # Extract details based on tool type
        details = self._format_tool_details(tool, request)
        self.state.add_tool_activity(tool, 'calling', details)
        
    def parse_tool_response(self, event: Dict[str, Any]):
        """
        Handle tool:response events.
        
        Expected event structure:
        {
            "message": "tool:response",
            "tool": "set_breakpoint",
            "success": true,
            "response": { ... }
        }
        """
        tool = event.get('tool', 'unknown')
        response = event.get('response', {})
        success = event.get('success', True)
        
        status = 'success' if success else 'error'
        details = self._format_response_details(tool, response)
        self.state.add_tool_activity(tool, status, details)
        
        # Handle specific tool responses
        if tool == 'set_breakpoint' and success:
            # Extract breakpoint info from response
            file_path = response.get('file', '')
            line = response.get('line', 0)
            
            # If not in response, check request data
            if not file_path and 'request' in event:
                request = event.get('request', {})
                file_path = request.get('file', '')
                line = request.get('line', 0)
                
            if file_path and line:
                # Normalize path for consistent display
                file_path = self._normalize_path(file_path)
                self.state.set_breakpoint(file_path, line)
                # Update view to show the breakpoint
                self.state.update_location(file_path, line)
                
    def parse_tool_error(self, event: Dict[str, Any]):
        """
        Handle tool:error events.
        
        Expected event structure:
        {
            "message": "tool:error",
            "tool": "start_debugging",
            "error": "Failed to connect"
        }
        """
        tool = event.get('tool', 'unknown')
        error = event.get('error', 'Unknown error')
        
        self.state.add_tool_activity(tool, 'error', f"Error: {error}")
        
    def parse_session_created(self, event: Dict[str, Any]):
        """
        Handle session:created events.
        
        Expected event structure:
        {
            "message": "session:created",
            "sessionId": "abc-123",
            "sessionName": "Debug Session",
            "language": "python"
        }
        """
        self.state.session_id = event.get('sessionId')
        self.state.session_name = event.get('sessionName', 'Debug Session')
        
        # Format session info
        if self.state.session_id:
            session_info = f"Created: {self.state.session_id[:8]}"
        else:
            session_info = "Created: unknown"
        if 'language' in event:
            session_info += f" ({event['language']})"
            
        self.state.add_tool_activity('session', 'success', session_info)
        
    def parse_session_closed(self, event: Dict[str, Any]):
        """
        Handle session:closed events.
        
        Expected event structure:
        {
            "message": "session:closed",
            "sessionId": "abc-123",
            "duration": 310000
        }
        """
        session_id = event.get('sessionId', 'unknown')
        duration = event.get('duration', 0)
        
        # Format duration
        duration_str = self._format_duration(duration)
        self.state.add_tool_activity('session', 'info', f'Closed after {duration_str}')
        
        # Reset session if it's the current one
        if self.state.session_id == session_id:
            self.state.reset_session()
        
    def parse_debug_state(self, event: Dict[str, Any]):
        """
        Handle debug:state events.
        
        Expected event structure:
        {
            "message": "debug:state",
            "event": "paused",
            "reason": "breakpoint",
            "location": {
                "file": "/path/to/file.py",
                "line": 42,
                "function": "main"
            }
        }
        """
        state_event = event.get('event', '')
        
        if state_event == 'paused':
            self.state.is_paused = True
            location = event.get('location', {})
            file_path = location.get('file', '')
            line = location.get('line', 0)
            function = location.get('function', '')
            
            if file_path and line:
                # Normalize path for display
                file_path = self._normalize_path(file_path)
                self.state.update_location(file_path, line)
                
            reason = event.get('reason', 'unknown')
            
            # Format pause message
            pause_msg = f"Paused: {reason}"
            if line:
                pause_msg += f" at line {line}"
            if function:
                pause_msg += f" in {function}()"
                
            self.state.add_tool_activity('debug', 'info', pause_msg)
            
        elif state_event == 'running':
            self.state.is_paused = False
            self.state.add_tool_activity('debug', 'info', "Running")
            
        elif state_event == 'stopped':
            self.state.is_paused = False
            self.state.add_tool_activity('debug', 'info', "Stopped")
            
    def parse_debug_breakpoint(self, event: Dict[str, Any]):
        """
        Handle debug:breakpoint events.
        
        Expected event structure:
        {
            "message": "debug:breakpoint",
            "event": "verified",
            "file": "/path/to/file.py",
            "line": 42,
            "verified": true
        }
        """
        bp_event = event.get('event', '')
        file_path = event.get('file', '')
        line = event.get('line', 0)
        verified = event.get('verified', False)
        
        if file_path and line:
            file_path = self._normalize_path(file_path)
            
            if bp_event == 'set':
                self.state.set_breakpoint(file_path, line)
                status = 'info'
                msg = f"Breakpoint set at line {line}"
                
            elif bp_event == 'verified':
                if verified:
                    status = 'success'
                    msg = f"Breakpoint verified at line {line}"
                else:
                    status = 'warning'
                    msg = f"Breakpoint unverified at line {line}"
                    
            elif bp_event == 'hit':
                status = 'info'
                msg = f"Hit breakpoint at line {line}"
                self.state.is_paused = True
                self.state.update_location(file_path, line)
                
            else:
                status = 'info'
                msg = f"Breakpoint {bp_event} at line {line}"
                
            self.state.add_tool_activity('breakpoint', status, msg)
            
    def parse_debug_variables(self, event: Dict[str, Any]):
        """
        Handle debug:variables events.
        
        Expected event structure:
        {
            "message": "debug:variables",
            "variables": [
                {"name": "x", "type": "int", "value": "42"},
                ...
            ],
            "variableCount": 3
        }
        """
        variables = event.get('variables', [])
        count = event.get('variableCount', len(variables))
        
        # Convert to simple dict for display
        var_dict = {}
        for var in variables[:20]:  # Limit to first 20 for display
            name = var.get('name', '')
            value = var.get('value', '')
            var_type = var.get('type', '')
            
            if name:
                # Format value with type if available
                if var_type and var_type != 'object':
                    display_value = f"{value} ({var_type})"
                else:
                    display_value = value
                    
                # Truncate long values
                if len(display_value) > 60:
                    display_value = display_value[:57] + '...'
                    
                var_dict[name] = display_value
                
        self.state.variables = var_dict
        
        # Add activity message
        if count > len(var_dict):
            msg = f"Retrieved {len(var_dict)} of {count} variables"
        else:
            msg = f"Retrieved {count} variables"
            
        self.state.add_tool_activity('variables', 'success', msg)
        
    def parse_debug_output(self, event: Dict[str, Any]):
        """
        Handle debug:output events (optional - for console output).
        
        Expected event structure:
        {
            "message": "debug:output",
            "category": "stdout",
            "output": "Hello, world!\n"
        }
        """
        category = event.get('category', 'output')
        output = event.get('output', '')
        
        if output:
            # Truncate long output
            if len(output) > 100:
                output = output[:97] + '...'
            
            # Remove trailing newlines for display
            output = output.rstrip('\n')
            
            self.state.add_tool_activity('output', 'info', f"{category}: {output}")
        
    def _format_tool_details(self, tool: str, request: Dict[str, Any]) -> str:
        """
        Format tool request details for display.
        
        Args:
            tool: Tool name
            request: Request parameters
            
        Returns:
            Formatted details string
        """
        if tool == 'set_breakpoint':
            file_path = request.get('file', 'unknown')
            line = request.get('line', '?')
            filename = os.path.basename(file_path)
            return f"{filename}:{line}"
            
        elif tool == 'start_debugging':
            script = request.get('scriptPath', 'unknown')
            return f"Script: {os.path.basename(script)}"
            
        elif tool == 'create_debug_session':
            name = request.get('name', 'Debug Session')
            lang = request.get('language', 'unknown')
            return f"{name} ({lang})"
            
        elif tool in ['step_over', 'step_into', 'step_out']:
            return "Stepping..."
            
        elif tool == 'get_variables':
            scope = request.get('scope', 'all')
            return f"Scope: {scope}"
            
        elif tool == 'continue_execution':
            return "Continuing..."
            
        # Default: show first few request params
        if request:
            params = []
            for k, v in list(request.items())[:3]:
                params.append(f"{k}={str(v)[:20]}")
            return ', '.join(params)
            
        return "Processing..."
        
    def _format_response_details(self, tool: str, response: Dict[str, Any]) -> str:
        """
        Format tool response details for display.
        
        Args:
            tool: Tool name
            response: Response data
            
        Returns:
            Formatted details string
        """
        if tool == 'create_debug_session':
            session_id = response.get('sessionId', 'unknown')
            return f"Session: {session_id[:8]}..."
            
        elif tool == 'set_breakpoint':
            line = response.get('line', '?')
            verified = response.get('verified', False)
            status = "verified" if verified else "pending"
            return f"Line {line} ({status})"
            
        elif tool == 'get_stack_trace':
            frames = response.get('stackFrames', [])
            return f"{len(frames)} frames"
            
        elif tool == 'get_variables':
            # Handled in parse_debug_variables
            return "Variables retrieved"
            
        elif tool in ['step_over', 'step_into', 'step_out']:
            return "Step complete"
            
        # Default success message
        return "Success"
        
    def _normalize_path(self, file_path: str) -> str:
        """
        Normalize file path for consistent display.
        
        Args:
            file_path: Raw file path from log
            
        Returns:
            Normalized absolute path
        """
        if not file_path:
            return file_path
            
        # Convert to Path object for normalization
        path = Path(file_path)
        
        # Make absolute if relative
        if not path.is_absolute():
            # Assume relative to current working directory
            path = Path.cwd() / path
            
        # Resolve to canonical path
        try:
            path = path.resolve()
        except Exception:
            # If resolve fails, just use as-is
            pass
            
        return str(path)
        
    def _format_duration(self, milliseconds: int) -> str:
        """
        Format duration from milliseconds to human-readable string.
        
        Args:
            milliseconds: Duration in milliseconds
            
        Returns:
            Formatted duration string
        """
        if milliseconds < 1000:
            return f"{milliseconds}ms"
        
        seconds = milliseconds / 1000
        if seconds < 60:
            return f"{seconds:.1f}s"
            
        minutes = int(seconds / 60)
        remaining_seconds = int(seconds % 60)
        
        if minutes < 60:
            return f"{minutes}m {remaining_seconds}s"
            
        hours = int(minutes / 60)
        remaining_minutes = int(minutes % 60)
        
        return f"{hours}h {remaining_minutes}m"


# Example usage for testing
if __name__ == "__main__":
    from .state import DebugState
    
    # Create test state
    state = DebugState()
    parser = LogEventParser(state)
    
    # Test event parsing
    test_event = {
        "message": "tool:call",
        "tool": "set_breakpoint",
        "request": {
            "file": "test.py",
            "line": 10
        }
    }
    
    parser.parse_tool_call(test_event)
    print(f"Tool activities: {state.tool_activities}")
