"""
Dynamic code window management for the debugger visualizer.

This module provides a sliding window view of code files that:
- Shows ~20 lines around the point of interest
- Follows execution as it moves through code
- Supports multiple files with caching
- Handles breakpoint and current line markers
"""

from typing import List, Tuple, Optional, Set, Dict
import os
from pathlib import Path


class CodeWindow:
    """Manages a sliding window view of code files."""
    
    def __init__(self, window_size: int = 20):
        """
        Initialize the code window manager.
        
        Args:
            window_size: Number of lines to show in the window
        """
        self.window_size = window_size
        self.file_cache: Dict[str, List[str]] = {}  # Cache loaded files
        self._last_window_params = None  # Track last window for smooth transitions
    
    def get_window(self, 
                   file_path: str, 
                   focus_line: int,
                   breakpoints: Optional[Set[int]] = None,
                   current_line: Optional[int] = None) -> Tuple[List[str], int, int]:
        """
        Get a window of code around the focus line.
        
        Args:
            file_path: Path to the source file
            focus_line: Line number to focus on (1-based)
            breakpoints: Set of line numbers with breakpoints
            current_line: Currently executing line number
        
        Returns:
            Tuple of:
            - List of formatted code lines with markers
            - Start line number (1-based)
            - End line number (1-based)
        """
        if breakpoints is None:
            breakpoints = set()
        
        # Normalize path for consistent caching
        file_path = str(Path(file_path).resolve())
        
        # Load file if not cached or if it might have changed
        if file_path not in self.file_cache:
            try:
                lines = self._load_file(file_path)
                if lines is None:
                    return self._error_window(f"Error: Could not read {file_path}")
            except Exception as e:
                return self._error_window(f"Error reading file: {str(e)}")
        else:
            lines = self.file_cache[file_path]
        
        if not lines:
            return self._error_window("Error: Empty file")
        
        total_lines = len(lines)
        
        # Calculate window bounds with smooth transitions
        start_line, end_line = self._calculate_window_bounds(
            focus_line, total_lines, file_path
        )
        
        # Extract lines and add markers
        window_lines = []
        for i in range(start_line - 1, end_line):
            if i < len(lines):
                line = lines[i].rstrip('\n\r')
                line_num = i + 1
                
                # Build marker string (2 chars: breakpoint + current)
                markers = self._build_markers(line_num, breakpoints, current_line)
                
                # Format the line with markers
                window_lines.append(f"{markers} {line}")
        
        return window_lines, start_line, end_line
    
    def _load_file(self, file_path: str) -> Optional[List[str]]:
        """
        Load a file into the cache.
        
        Args:
            file_path: Path to the file to load
            
        Returns:
            List of lines or None if error
        """
        try:
            # Try different encodings to handle various file types
            encodings = ['utf-8', 'latin-1', 'cp1252']
            
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        lines = f.readlines()
                        self.file_cache[file_path] = lines
                        return lines
                except UnicodeDecodeError:
                    continue
            
            # If all encodings fail, try binary mode and decode what we can
            with open(file_path, 'rb') as f:
                content = f.read()
                lines = content.decode('utf-8', errors='replace').splitlines(True)
                self.file_cache[file_path] = lines
                return lines
                
        except FileNotFoundError:
            return None
        except PermissionError:
            return None
        except Exception:
            return None
    
    def _calculate_window_bounds(self, focus_line: int, total_lines: int, 
                                file_path: str) -> Tuple[int, int]:
        """
        Calculate window bounds with smooth scrolling behavior.
        
        Args:
            focus_line: Line to focus on
            total_lines: Total lines in the file
            file_path: Path to track window state per file
            
        Returns:
            Tuple of (start_line, end_line) both 1-based
        """
        # Ensure focus line is valid
        focus_line = max(1, min(focus_line, total_lines))
        
        # Calculate ideal window centered on focus line
        half_window = self.window_size // 2
        ideal_start = focus_line - half_window
        ideal_end = ideal_start + self.window_size - 1
        
        # Adjust for file boundaries
        if ideal_start < 1:
            start_line = 1
            end_line = min(self.window_size, total_lines)
        elif ideal_end > total_lines:
            end_line = total_lines
            start_line = max(1, end_line - self.window_size + 1)
        else:
            start_line = ideal_start
            end_line = ideal_end
        
        # Smooth scrolling: try to keep window stable unless focus moves out
        if self._last_window_params and self._last_window_params[0] == file_path:
            last_start, last_end = self._last_window_params[1], self._last_window_params[2]
            
            # If focus is still within the last window, keep it stable
            if last_start <= focus_line <= last_end:
                # Only scroll if we're near the edges
                edge_margin = 3
                if focus_line - last_start < edge_margin:
                    # Near top edge, scroll up
                    start_line = max(1, focus_line - edge_margin)
                    end_line = min(total_lines, start_line + self.window_size - 1)
                elif last_end - focus_line < edge_margin:
                    # Near bottom edge, scroll down
                    end_line = min(total_lines, focus_line + edge_margin)
                    start_line = max(1, end_line - self.window_size + 1)
                else:
                    # Keep the window stable
                    start_line, end_line = last_start, last_end
        
        # Remember this window for next time
        self._last_window_params = (file_path, start_line, end_line)
        
        return start_line, end_line
    
    def _build_markers(self, line_num: int, breakpoints: Set[int], 
                      current_line: Optional[int]) -> str:
        """
        Build the marker string for a line.
        
        Args:
            line_num: Line number
            breakpoints: Set of breakpoint line numbers
            current_line: Currently executing line number
            
        Returns:
            2-character marker string
        """
        # First character: breakpoint marker
        if line_num in breakpoints:
            marker1 = "●"
        else:
            marker1 = " "
        
        # Second character: current line marker
        if current_line and line_num == current_line:
            marker2 = "→"
        else:
            marker2 = " "
        
        return marker1 + marker2
    
    def _error_window(self, error_msg: str) -> Tuple[List[str], int, int]:
        """
        Create an error window when file cannot be loaded.
        
        Args:
            error_msg: Error message to display
            
        Returns:
            Standard window tuple with error message
        """
        return [f"   {error_msg}"], 1, 1
    
    def clear_cache(self, file_path: Optional[str] = None) -> None:
        """
        Clear file cache.
        
        Args:
            file_path: Specific file to clear, or None to clear all
        """
        if file_path:
            # Normalize the path before clearing
            file_path = str(Path(file_path).resolve())
            self.file_cache.pop(file_path, None)
            # Also clear window params if it was for this file
            if self._last_window_params and self._last_window_params[0] == file_path:
                self._last_window_params = None
        else:
            self.file_cache.clear()
            self._last_window_params = None
    
    def invalidate_file(self, file_path: str) -> None:
        """
        Mark a file as needing reload (e.g., after edits).
        
        Args:
            file_path: Path to the file to invalidate
        """
        self.clear_cache(file_path)
    
    def get_cached_files(self) -> List[str]:
        """
        Get list of currently cached file paths.
        
        Returns:
            List of file paths in cache
        """
        return list(self.file_cache.keys())
