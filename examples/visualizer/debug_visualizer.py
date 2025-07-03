"""
Main TUI application for the MCP debugger visualizer.

This module provides the main application class that:
- Manages the overall layout
- Coordinates state updates
- Handles the live display loop
"""

from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.text import Text
import time
from typing import Optional, Dict
import os
import sys

from .panels import ToolActivityPanel, CodeViewPanel, HeaderPanel
from .state import DebugState


class DebugVisualizer:
    """Main application class for the debug visualizer TUI."""
    
    def __init__(self):
        """Initialize the debug visualizer."""
        self.console = Console()
        self.state = DebugState()
        
        # Create panel instances
        self.tool_panel = ToolActivityPanel()
        self.code_panel = CodeViewPanel()
        
        # Create the layout
        self.layout = self._create_layout()
        
        # Track if we're running
        self.running = True
    
    def _create_layout(self) -> Layout:
        """
        Create the main application layout.
        
        Returns:
            Layout with header and two-column body
        """
        layout = Layout()
        
        # Split into header and body
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body"),
        )
        
        # Split body into two columns
        layout["body"].split_row(
            Layout(name="tools", ratio=2),
            Layout(name="code", ratio=3)
        )
        
        return layout
    
    def update_header(self) -> None:
        """Update the header panel with current state."""
        # Get current location string
        location_str = None
        if self.state.current_location:
            location_str = str(self.state.current_location)
        
        # Render header panel
        header = HeaderPanel.render(
            session_id=self.state.session_id,
            session_name=self.state.session_name,
            current_location=location_str,
            is_paused=self.state.is_paused
        )
        
        self.layout["header"].update(header)
    
    def update_tools_panel(self) -> None:
        """Update the tool activity panel."""
        tools = self.tool_panel.render(self.state.tool_activities)
        self.layout["tools"].update(tools)
    
    def update_code_panel(self) -> None:
        """Update the code view panel."""
        # Get current file and line from state
        file_path = None
        current_line = None
        
        if self.state.current_location:
            file_path = self.state.current_location.file_path
            current_line = self.state.current_location.line
        
        # Render code panel
        code = self.code_panel.render(
            file_path=file_path,
            current_line=current_line,
            breakpoints=self.state.breakpoints,
            variables=self.state.variables
        )
        
        self.layout["code"].update(code)
    
    def render(self) -> Layout:
        """
        Update all panels and return the layout.
        
        Returns:
            Updated layout ready for display
        """
        try:
            self.update_header()
            self.update_tools_panel()
            self.update_code_panel()
        except Exception as e:
            # If there's an error, show it in the layout
            error_text = Text(f"Error updating display: {str(e)}", style="bold red")
            self.layout["body"].update(Panel(error_text, title="Error", border_style="red"))
        
        return self.layout
    
    def run(self) -> None:
        """Run the live display loop."""
        try:
            with Live(
                self.render(),
                refresh_per_second=4,
                console=self.console,
                screen=True  # Use alternate screen buffer
            ) as live:
                while self.running:
                    live.update(self.render())
                    time.sleep(0.25)  # Update 4 times per second
        except KeyboardInterrupt:
            self.running = False
            self.console.print("\n[yellow]Debug visualizer stopped.[/yellow]")
    
    def stop(self) -> None:
        """Stop the visualizer."""
        self.running = False
    
    # State update methods for external control
    
    def create_session(self, session_id: str, session_name: Optional[str] = None) -> None:
        """
        Create a new debug session.
        
        Args:
            session_id: Unique session identifier
            session_name: Human-readable session name
        """
        self.state.session_id = session_id
        self.state.session_name = session_name
        self.state.add_tool_activity("create_debug_session", "success", f"Session: {session_id}")
    
    def set_breakpoint(self, file_path: str, line: int) -> None:
        """
        Set a breakpoint at the specified location.
        
        Args:
            file_path: Path to the source file
            line: Line number for the breakpoint
        """
        self.state.set_breakpoint(file_path, line)
        self.state.add_tool_activity(
            "set_breakpoint", 
            "success", 
            f"Breakpoint at {os.path.basename(file_path)}:{line}"
        )
        
        # Update location to show the file with the new breakpoint
        if not self.state.current_location:
            self.state.update_location(file_path, line)
    
    def start_debugging(self, script_path: str) -> None:
        """
        Start debugging a script.
        
        Args:
            script_path: Path to the script being debugged
        """
        self.state.add_tool_activity(
            "start_debugging",
            "success",
            f"Started {os.path.basename(script_path)}"
        )
    
    def pause_at_breakpoint(self, file_path: str, line: int) -> None:
        """
        Pause execution at a breakpoint.
        
        Args:
            file_path: Path to the source file
            line: Line number where execution paused
        """
        self.state.is_paused = True
        self.state.update_location(file_path, line)
        self.state.add_tool_activity(
            "pause",
            "info",
            f"Paused at breakpoint line {line}"
        )
    
    def update_variables(self, variables: Dict[str, str]) -> None:
        """
        Update the current variable values.
        
        Args:
            variables: Dictionary of variable names to values
        """
        self.state.update_variables(variables)
        self.state.add_tool_activity(
            "get_variables",
            "success",
            f"Retrieved {len(variables)} variables"
        )
    
    def step_to_line(self, file_path: str, line: int, step_type: str = "over") -> None:
        """
        Step to a new line.
        
        Args:
            file_path: Path to the source file
            line: New line number
            step_type: Type of step (over, into, out)
        """
        self.state.update_location(file_path, line)
        self.state.add_tool_activity(
            f"step_{step_type}",
            "success",
            f"Stepped to line {line}"
        )
    
    def continue_execution(self) -> None:
        """Continue execution from a pause."""
        self.state.is_paused = False
        self.state.add_tool_activity(
            "continue",
            "success",
            "Continued execution"
        )
    
    def close_session(self) -> None:
        """Close the current debug session."""
        session_id = self.state.session_id
        self.state.reset_session()
        self.state.add_tool_activity(
            "close_debug_session",
            "success",
            f"Closed session {session_id}"
        )


def main():
    """Entry point for running the visualizer standalone."""
    viz = DebugVisualizer()
    
    # Example of how to use it
    print("Starting MCP Debug Visualizer...")
    print("Press Ctrl+C to exit")
    
    try:
        viz.run()
    except KeyboardInterrupt:
        print("\nExiting...")


if __name__ == "__main__":
    main()
