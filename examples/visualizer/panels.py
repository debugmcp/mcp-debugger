"""
UI panel components for the debugger visualizer.

This module provides Rich-based panels for:
- Tool activity display
- Code view with syntax highlighting
"""

from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table
from rich.text import Text
from rich.console import Group, RenderableType
from rich.columns import Columns
from typing import List, Set, Dict, Optional, Tuple
import os

from .state import ToolActivity
from .code_window import CodeWindow


class ToolActivityPanel:
    """Panel for displaying MCP tool activity history."""
    
    def __init__(self):
        """Initialize the tool activity panel."""
        self.icons = {
            'calling': '⟳',
            'success': '✓',
            'error': '✗'
        }
        self.colors = {
            'calling': 'blue',
            'success': 'green',
            'error': 'red'
        }
    
    def render(self, activities: List[ToolActivity]) -> Panel:
        """
        Render the tool activity panel.
        
        Args:
            activities: List of tool activities to display
            
        Returns:
            Rich Panel with formatted tool activity
        """
        if not activities:
            content = Text("No activity yet", style="dim italic")
        else:
            lines = []
            
            for activity in activities:
                # Get icon and color for status
                icon = self.icons.get(activity.status, '?')
                color = self.colors.get(activity.status, 'white')
                
                # Create formatted text for this activity
                text = Text()
                text.append(f"{icon} ", style=f"bold {color}")
                text.append(activity.tool, style="bold white")
                
                # Add details on next line with indentation
                if activity.details:
                    text.append(f"\n  {activity.details}", style="dim")
                
                lines.append(text)
            
            # Combine all activities with spacing
            content = Group(*[line for line in lines])
        
        return Panel(
            content,
            title="[bold blue]MCP Tool Activity[/bold blue]",
            border_style="blue",
            padding=(1, 2)
        )


class CodeViewPanel:
    """Panel for displaying code with syntax highlighting and debugging markers."""
    
    def __init__(self):
        """Initialize the code view panel."""
        self.code_window = CodeWindow(window_size=20)
    
    def render(self, 
               file_path: Optional[str], 
               current_line: Optional[int],
               breakpoints: Dict[str, Set[int]], 
               variables: Dict[str, str]) -> Panel:
        """
        Render the code view panel with syntax highlighting.
        
        Args:
            file_path: Path to the current file
            current_line: Currently executing line number
            breakpoints: Dictionary of file paths to breakpoint line numbers
            variables: Current variable values
            
        Returns:
            Rich Panel with formatted code
        """
        if not file_path:
            content = Text("No file loaded", style="dim italic")
            title = "[bold green]Code View[/bold green]"
        else:
            # Determine focus line
            focus_line = self._determine_focus_line(
                file_path, current_line, breakpoints
            )
            
            # Get code window
            file_breakpoints = breakpoints.get(file_path, set())
            window_lines, start_line, end_line = self.code_window.get_window(
                file_path, focus_line, file_breakpoints, current_line
            )
            
            # Create content with proper formatting
            content_parts = []
            
            # Add the code with line numbers and syntax highlighting
            if window_lines:
                # Use simple formatting for all files to ensure it works
                code_lines = []
                for i, line in enumerate(window_lines):
                    line_num = start_line + i
                    
                    # Extract markers and code
                    if len(line) >= 3:
                        markers = line[:2]
                        code = line[3:]
                    else:
                        markers = "  "
                        code = line
                    
                    # Create formatted line
                    formatted_line = Text()
                    
                    # Add line number
                    formatted_line.append(f"{line_num:3d} ", style="dim")
                    
                    # Add markers with appropriate styling
                    if '●' in markers and '→' in markers:
                        # Both breakpoint and current line
                        formatted_line.append(markers, style="bold red on yellow")
                    elif '●' in markers:
                        # Just breakpoint
                        formatted_line.append(markers, style="bold red")
                    elif '→' in markers:
                        # Just current line
                        formatted_line.append(markers, style="bold yellow")
                    else:
                        # No markers
                        formatted_line.append(markers)
                    
                    # Add code
                    formatted_line.append(" ")
                    if current_line and line_num == current_line:
                        # Highlight current line
                        formatted_line.append(code, style="on grey23")
                    else:
                        formatted_line.append(code)
                    
                    code_lines.append(formatted_line)
                
                content_parts.extend(code_lines)
            
            # Add variables section if available
            if variables:
                # Add separator
                content_parts.append(Text("─" * 50, style="dim"))
                
                # Format variables
                var_parts = []
                for name, value in sorted(variables.items()):
                    var_text = Text()
                    var_text.append(name, style="bold cyan")
                    var_text.append(" = ", style="dim")
                    var_text.append(value, style="yellow")
                    var_parts.append(var_text)
                
                var_header = Text("Variables: ", style="bold white")
                content_parts.append(var_header)
                content_parts.extend(var_parts)
            
            # Combine all content
            content = Group(*content_parts) if content_parts else Text("Loading...", style="dim")
            
            # Create title with filename and line range
            filename = os.path.basename(file_path) if file_path else "Code View"
            title = f"[bold green]{filename}[/bold green] (lines {start_line}-{end_line})"
        
        return Panel(
            content,
            title=title,
            border_style="green",
            padding=(1, 2)
        )
    
    def _determine_focus_line(self, file_path: str, current_line: Optional[int],
                             breakpoints: Dict[str, Set[int]]) -> int:
        """
        Determine which line to focus on in the code window.
        
        Priority:
        1. Current execution line
        2. First breakpoint in file
        3. Line 1
        
        Args:
            file_path: Path to the file
            current_line: Currently executing line
            breakpoints: All breakpoints
            
        Returns:
            Line number to focus on
        """
        # Priority 1: Current line
        if current_line:
            return current_line
        
        # Priority 2: First breakpoint
        file_breakpoints = breakpoints.get(file_path, set())
        if file_breakpoints:
            return min(file_breakpoints)
        
        # Default: Line 1
        return 1
    
    def clear_cache(self, file_path: Optional[str] = None) -> None:
        """
        Clear the code window file cache.
        
        Args:
            file_path: Specific file to clear, or None for all
        """
        self.code_window.clear_cache(file_path)


class HeaderPanel:
    """Panel for displaying session information and status."""
    
    @staticmethod
    def render(session_id: Optional[str], 
               session_name: Optional[str],
               current_location: Optional[str],
               is_paused: bool) -> Panel:
        """
        Render the header panel.
        
        Args:
            session_id: Current session ID
            session_name: Human-readable session name
            current_location: Current file:line location
            is_paused: Whether execution is paused
            
        Returns:
            Rich Panel with header information
        """
        header_text = Text()
        
        # Main title
        header_text.append("MCP Debugger", style="bold blue")
        
        # Session info
        if session_id:
            header_text.append(" - Session: ", style="dim")
            if session_name:
                header_text.append(f"{session_name}", style="cyan")
            else:
                header_text.append(f"{session_id[:8]}...", style="cyan")
        
        # Current location
        if current_location:
            header_text.append(" | ", style="dim")
            header_text.append(current_location, style="yellow")
        
        # Execution state
        header_text.append(" | ", style="dim")
        if is_paused:
            header_text.append("[PAUSED]", style="bold red blink")
        else:
            header_text.append("[RUNNING]", style="bold green")
        
        return Panel(
            header_text,
            style="bold on grey23",
            padding=(0, 2)
        )
