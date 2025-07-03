"""
Application state management for the debugger visualizer.

This module manages the debugging session state including:
- Tool activity history
- Current execution location
- Breakpoints
- Variables
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set
import time


@dataclass
class ToolActivity:
    """Represents a single MCP tool invocation and its result."""
    tool: str
    status: str  # 'calling', 'success', 'error'
    details: str
    timestamp: float


@dataclass
class CodeLocation:
    """Represents a location in code (file + line number)."""
    file_path: str
    line: int
    
    def __str__(self) -> str:
        """String representation for display."""
        import os
        return f"{os.path.basename(self.file_path)}:{self.line}"


@dataclass
class DebugState:
    """Central state management for the debugger visualizer."""
    
    # Session info
    session_id: Optional[str] = None
    session_name: Optional[str] = None
    
    # Current execution state
    current_location: Optional[CodeLocation] = None
    is_paused: bool = False
    
    # Breakpoints: Dict[file_path, Set[line_numbers]]
    breakpoints: Dict[str, Set[int]] = field(default_factory=dict)
    
    # Variables at current scope
    variables: Dict[str, str] = field(default_factory=dict)
    
    # Tool activity history (limited to prevent memory growth)
    tool_activities: List[ToolActivity] = field(default_factory=list)
    max_activities: int = 20
    
    def add_tool_activity(self, tool: str, status: str, details: str) -> None:
        """
        Add a new tool activity to the history.
        
        Args:
            tool: Name of the MCP tool
            status: Status of the tool call ('calling', 'success', 'error')
            details: Human-readable details about the activity
        """
        activity = ToolActivity(tool, status, details, time.time())
        self.tool_activities.append(activity)
        
        # Keep only last N activities to prevent memory growth
        if len(self.tool_activities) > self.max_activities:
            self.tool_activities.pop(0)
    
    def set_breakpoint(self, file_path: str, line: int) -> None:
        """
        Add a breakpoint at the specified location.
        
        Args:
            file_path: Path to the source file
            line: Line number for the breakpoint
        """
        if file_path not in self.breakpoints:
            self.breakpoints[file_path] = set()
        self.breakpoints[file_path].add(line)
    
    def remove_breakpoint(self, file_path: str, line: int) -> None:
        """
        Remove a breakpoint at the specified location.
        
        Args:
            file_path: Path to the source file
            line: Line number of the breakpoint to remove
        """
        if file_path in self.breakpoints:
            self.breakpoints[file_path].discard(line)
            # Clean up empty sets
            if not self.breakpoints[file_path]:
                del self.breakpoints[file_path]
    
    def update_location(self, file_path: str, line: int) -> None:
        """
        Update the current execution location.
        
        Args:
            file_path: Path to the current source file
            line: Current line number
        """
        self.current_location = CodeLocation(file_path, line)
    
    def clear_variables(self) -> None:
        """Clear all variables (e.g., when leaving scope)."""
        self.variables.clear()
    
    def update_variables(self, variables: Dict[str, str]) -> None:
        """
        Update the variable values.
        
        Args:
            variables: Dictionary of variable name to value strings
        """
        self.variables = variables.copy()
    
    def reset_session(self) -> None:
        """Reset all session-specific state."""
        self.session_id = None
        self.session_name = None
        self.current_location = None
        self.is_paused = False
        self.breakpoints.clear()
        self.variables.clear()
        # Keep tool activities for history
    
    def get_breakpoints_for_file(self, file_path: str) -> Set[int]:
        """
        Get all breakpoints for a specific file.
        
        Args:
            file_path: Path to the source file
            
        Returns:
            Set of line numbers with breakpoints (empty set if none)
        """
        return self.breakpoints.get(file_path, set())
    
    def has_breakpoint(self, file_path: str, line: int) -> bool:
        """
        Check if a specific line has a breakpoint.
        
        Args:
            file_path: Path to the source file
            line: Line number to check
            
        Returns:
            True if there's a breakpoint at this location
        """
        return line in self.breakpoints.get(file_path, set())
