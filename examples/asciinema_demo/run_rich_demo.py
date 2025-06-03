import json
import subprocess
import time
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text

# --- Configuration ---
# Assuming this script is in examples/asciinema_demo/
# Project root is two levels up from this script's directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT_TO_DEBUG_RELPATH = Path("examples/asciinema_demo/buggy_event_processor.py")
SCRIPT_TO_DEBUG_ABSPATH = PROJECT_ROOT / SCRIPT_TO_DEBUG_RELPATH
MCP_SERVER_JS_RELPATH = Path("dist/index.js") # Path to the compiled MCP server (output of tsc)
MCP_SERVER_JS_ABSPATH = PROJECT_ROOT / MCP_SERVER_JS_RELPATH

# Ensure the script to debug exists
if not SCRIPT_TO_DEBUG_ABSPATH.exists():
    print(f"Error: Script to debug not found at {SCRIPT_TO_DEBUG_ABSPATH}")
    exit(1)

# Ensure the MCP server script exists
if not MCP_SERVER_JS_ABSPATH.exists():
    print(f"Error: MCP Server script not found at {MCP_SERVER_JS_ABSPATH}. Please build the server (npm run build).")
    exit(1)

# Load the source code of the script to debug
with open(SCRIPT_TO_DEBUG_ABSPATH, "r") as f:
    SCRIPT_CODE = f.read()

CONSOLE = Console()

# --- Rich Layout Setup ---
layout = Layout(name="root")
layout.split_column(
    Layout(name="header", size=3),
    Layout(name="main_row"),
    Layout(name="footer", size=1)
)
layout["main_row"].split_row(
    Layout(name="left_pane", ratio=1),
    Layout(name="right_pane", ratio=1),
)

# --- MCP Interaction State ---
mcp_server_process: Optional[subprocess.Popen] = None
mcp_request_id_counter = 0
current_mcp_session_id: Optional[str] = None
log_lines: List[Text] = []
current_line_highlight: Optional[int] = None
breakpoint_lines: List[int] = []

# --- Helper Functions ---

def add_log_message(message: str, style: str = ""):
    """Adds a message to the log pane."""
    log_lines.append(Text(message, style=style))
    if len(log_lines) > CONSOLE.height - 5: # Keep log from overflowing too much
        log_lines.pop(0)

def update_code_pane():
    """Updates the right pane with the source code and highlights."""
    code_lines = SCRIPT_CODE.splitlines()
    display_lines = []
    for i, line_content in enumerate(code_lines):
        line_num = i + 1
        prefix = "   "
        if line_num == current_line_highlight:
            prefix = " H>"
            style = "black on bright_yellow"
        elif line_num in breakpoint_lines:
            prefix = " B>"
            style = "red"
        else:
            style = ""
        
        # Basic syntax highlighting for Python keywords for demo purposes
        # Rich's Syntax object is better but harder to integrate with per-line styling here
        text_line = Text(f"{line_num:2d}{prefix} {line_content}", style=style)
        if "def " in line_content or "if " in line_content or "for " in line_content or "return " in line_content:
             text_line.highlight_words(["def", "if", "for", "return", "in", "else", "elif"], "bold magenta")
        text_line.highlight_words(["print", "range", "list", "dict", "str", "int", "open"], "cyan")
        text_line.highlight_regex(r"#[^\n]*", "italic green") # Comments
        text_line.highlight_regex(r"\"\"\"[^\"]*\"\"\"", "italic green") # Docstrings
        text_line.highlight_regex(r"\'\'\'[^\']*\'\'\'", "italic green") # Docstrings


        display_lines.append(text_line)
    
    # Using Syntax for proper highlighting, but it's a single block
    # For per-line styling (breakpoints, current line), manual Text objects are easier
    # For a real app, a more sophisticated approach would be needed.
    # For this demo, we'll use manually styled Text objects.
    # syntax = Syntax(SCRIPT_CODE, "python", theme="monokai", line_numbers=True)
    # layout["right_pane"].update(Panel(syntax, title=f"{SCRIPT_TO_DEBUG_RELPATH.name}"))
    
    layout["right_pane"].update(Panel(Text("\n").join(display_lines), title=f"{SCRIPT_TO_DEBUG_RELPATH.name}"))


def start_mcp_server():
    global mcp_server_process
    add_log_message("Starting MCP Debugger server...", "yellow")
    try:
        # Start the Node.js server using STDIN/STDOUT for MCP communication
        mcp_server_process = subprocess.Popen(
            ["node", str(MCP_SERVER_JS_ABSPATH)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, # Capture stderr for debugging the server itself
            text=True,
            cwd=PROJECT_ROOT, # Run from project root
            bufsize=1 # Line-buffered
        )
        time.sleep(1) # Give it a moment to start
        
        # Non-blocking read for stderr
        # TODO: Set up a separate thread to monitor stderr if needed for longer runs
        # For now, just check initial output
        if mcp_server_process.stderr:
            try:
                # Attempt a non-blocking read for initial stderr
                # This requires setting the stream to non-blocking, which is platform-dependent.
                # For simplicity in this demo, we'll do a quick readline.
                # A more robust solution might involve select() or a separate thread.
                # server_stderr = mcp_server_process.stderr.readline() # This can block
                # For now, let's skip trying to read initial stderr to avoid blocking issues in demo
                pass # Placeholder for potential non-blocking read or initial check
            except Exception: # Catch any issue with readline, e.g. if stream closes
                pass 
        
        # Check if server started successfully
        if mcp_server_process.poll() is None:
            add_log_message("MCP Debugger server started.", "green")
        else:
            add_log_message(f"MCP Debugger server failed to start. Return code: {mcp_server_process.poll()}", "bold red")
            mcp_server_process = None
            # Print all stderr
            if mcp_server_process and mcp_server_process.stderr:
                for line in mcp_server_process.stderr.readlines():
                    add_log_message(f"MCP Server STDERR: {line.strip()}", "dim red")


    except Exception as e:
        add_log_message(f"Failed to start MCP server: {e}", "bold red")
        mcp_server_process = None

def send_mcp_request(tool_name: str, arguments: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    global mcp_request_id_counter
    if not mcp_server_process or not mcp_server_process.stdin or not mcp_server_process.stdout:
        add_log_message("MCP server not running.", "bold red")
        return None

    mcp_request_id_counter += 1
    request_id = f"rich-demo-{mcp_request_id_counter}"
    
    request_payload = {
        "type": "request",
        "id": request_id,
        "tool": tool_name,
        "arguments": arguments
    }
    
    request_str = json.dumps(request_payload)
    add_log_message(f"\n>> LLM Request ({request_id}):", "bold blue")
    add_log_message(json.dumps(request_payload, indent=2), "blue")

    try:
        mcp_server_process.stdin.write(request_str + "\n")
        mcp_server_process.stdin.flush()

        # Read response (this is a blocking call, assumes one response per request for simplicity)
        # A real client would handle async messages, multiple responses, events, etc.
        response_str = mcp_server_process.stdout.readline()
        if not response_str:
            add_log_message("No response from MCP server (EOF).", "bold red")
            return None
        
        response_payload = json.loads(response_str)
        add_log_message(f"\n<< MCP Response ({response_payload.get('id')}):", "bold green")
        add_log_message(json.dumps(response_payload, indent=2), "green")
        
        # Handle potential events that might come before the actual response
        # This is a simplified handler. A robust client needs a message loop.
        while response_payload.get("type") == "event" or response_payload.get("id") != request_id:
            # Process event (e.g. stoppedEvent)
            if response_payload.get("type") == "event":
                handle_mcp_event(response_payload)

            response_str = mcp_server_process.stdout.readline()
            if not response_str:
                 add_log_message("No further response from MCP server (EOF) while waiting for request ID.", "bold red")
                 return None
            response_payload = json.loads(response_str)
            add_log_message(f"\n<< MCP Event/Other Response ({response_payload.get('id')}):", "dim green")
            add_log_message(json.dumps(response_payload, indent=2), "dim green")


        return response_payload.get("result") # Assuming result is always in response.result

    except Exception as e:
        add_log_message(f"Error communicating with MCP server: {e}", "bold red")
        return None

def handle_mcp_event(event_payload: Dict[str, Any]):
    global current_line_highlight
    event_name = event_payload.get("event")
    add_log_message(f"\n-- MCP Event: {event_name} --", "magenta")
    add_log_message(json.dumps(event_payload, indent=2), "magenta")

    if event_name == "stoppedEvent":
        body = event_payload.get("body", {})
        reason = body.get("reason")
        thread_id = body.get("threadId")
        add_log_message(f"Execution paused (Thread: {thread_id}, Reason: {reason})", "yellow")
        # We need to get stack trace to find the line
        # This event itself doesn't always give the line number directly in a simple way
        # For now, we'll rely on subsequent get_stack_trace calls to update highlight

    elif event_name == "breakpointEvent":
        body = event_payload.get("body", {})
        reason = body.get("reason")
        breakpoint_info = body.get("breakpoint", {})
        if reason == "changed" or reason == "new":
            if breakpoint_info.get("verified") and "line" in breakpoint_info:
                bp_line = breakpoint_info["line"]
                if bp_line not in breakpoint_lines:
                    breakpoint_lines.append(bp_line)
                add_log_message(f"Breakpoint at line {bp_line} verified.", "yellow")


def stop_mcp_server():
    global mcp_server_process
    if mcp_server_process:
        add_log_message("Stopping MCP Debugger server...", "yellow")
        if mcp_server_process.stdin:
            mcp_server_process.stdin.close() # Signal EOF
        
        # Terminate if it doesn't close gracefully
        try:
            mcp_server_process.wait(timeout=2) # Wait for graceful exit
        except subprocess.TimeoutExpired:
            add_log_message("Server did not exit gracefully, terminating.", "yellow")
            mcp_server_process.terminate()
            try:
                mcp_server_process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                add_log_message("Server did not terminate, killing.", "red")
                mcp_server_process.kill()
        
        # Capture any final stderr output
        if mcp_server_process.stderr:
            for line in mcp_server_process.stderr.readlines():
                add_log_message(f"MCP Server STDERR (shutdown): {line.strip()}", "dim red")

        add_log_message("MCP Debugger server stopped.", "green")
        mcp_server_process = None


# --- Main Demo Logic ---
def run_demo():
    global current_mcp_session_id, current_line_highlight, breakpoint_lines
    
    layout["header"].update(Panel(Text("MCP Debugger - Rich Demo", justify="center", style="bold white on blue")))
    layout["footer"].update(Text("Press Ctrl+C to exit (may take a moment)", style="dim"))

    with CONSOLE.screen() as screen:
        start_mcp_server()
        if not mcp_server_process:
            CONSOLE.print("Failed to start MCP server. Exiting demo.")
            return

        # Initial UI update
        update_code_pane()
        layout["left_pane"].update(Panel(Text("\n").join(log_lines), title="LLM & MCP Log"))
        screen.update(layout)
        time.sleep(1)

        # --- Demo Step 1: Create Debug Session ---
        add_log_message("\n--- STEP 1: Create Debug Session ---", "bold yellow")
        result = send_mcp_request("create_debug_session", {"language": "python"})
        if result and result.get("success"):
            current_mcp_session_id = result.get("sessionId")
            add_log_message(f"Debug session created: {current_mcp_session_id}", "bold green")
        else:
            add_log_message("Failed to create debug session.", "bold red")
            stop_mcp_server()
            return
        
        update_code_pane() # No code change, but refresh log
        layout["left_pane"].update(Panel(Text("\n").join(log_lines), title="LLM & MCP Log"))
        screen.update(layout)
        time.sleep(2)

        # --- Demo Step 2: Set Breakpoint ---
        # (More steps will be added here: set_breakpoint, start_debugging, step, get_variables etc.)
        # For now, just a placeholder for the next step
        if current_mcp_session_id:
            add_log_message("\n--- STEP 2: Set Breakpoint (Example) ---", "bold yellow")
            bp_line_num = 13 # Line: `if event_data["value"] > important_threshold:`
            breakpoint_lines.append(bp_line_num) # Optimistically add
            result = send_mcp_request("set_breakpoint", {
                "sessionId": current_mcp_session_id,
                "file": str(SCRIPT_TO_DEBUG_RELPATH), # Relative path from project root
                "line": bp_line_num 
            })
            if not (result and result.get("success")):
                add_log_message(f"Failed to set breakpoint at line {bp_line_num}.", "bold red")
            # Verification comes via breakpointEvent or when debugger stops

            update_code_pane()
            layout["left_pane"].update(Panel(Text("\n").join(log_lines), title="LLM & MCP Log"))
            screen.update(layout)
            time.sleep(2)

        # --- Demo Step 3: Start Debugging ---
        if current_mcp_session_id:
            add_log_message("\n--- STEP 3: Start Debugging ---", "bold yellow")
            result = send_mcp_request("start_debugging", {
                "sessionId": current_mcp_session_id,
                "scriptPath": str(SCRIPT_TO_DEBUG_RELPATH)
            })
            # Expecting a stoppedEvent if breakpoint is hit, handled by handle_mcp_event
            # The send_mcp_request will try to read events after the main response.
            # We might need a loop here to process multiple events if the script runs and hits things.
            
            # For this initial version, we assume the response to start_debugging might be simple,
            # and subsequent events are handled by the event loop (which is simplified here).
            # A proper demo would need to poll/process stdout for multiple event messages.
            
            # Let's try to read a few more potential events after start_debugging response
            if mcp_server_process and mcp_server_process.stdout:
                for _ in range(5): # Try to catch a few events
                    try:
                        mcp_server_process.stdout.channel.setblocking(0) # type: ignore
                        event_str = mcp_server_process.stdout.readline()
                        mcp_server_process.stdout.channel.setblocking(1) # type: ignore
                        if event_str:
                            event_payload = json.loads(event_str)
                            handle_mcp_event(event_payload)
                        else:
                            break 
                    except (BlockingIOError, json.JSONDecodeError):
                        mcp_server_process.stdout.channel.setblocking(1) # type: ignore
                        break # No more immediate events
                    except Exception:
                        mcp_server_process.stdout.channel.setblocking(1) # type: ignore
                        break # Other error
            
            # After starting, if it stopped, a get_stack_trace would update current_line_highlight
            # This part needs refinement based on actual event flow.
            # For now, we'll assume if a stoppedEvent occurred, handle_mcp_event logged it.
            # To update the highlight, we'd call get_stack_trace.
            time.sleep(0.5) # allow events to process
            stack_trace_result = send_mcp_request("get_stack_trace", {"sessionId": current_mcp_session_id})
            if stack_trace_result and stack_trace_result.get("success"):
                frames = stack_trace_result.get("stackFrames", [])
                if frames:
                    # Find the frame corresponding to our script
                    for frame in frames:
                        frame_file = Path(frame.get("file", ""))
                        # Compare relative paths or resolve to absolute if necessary
                        if SCRIPT_TO_DEBUG_ABSPATH.samefile(frame_file):
                            current_line_highlight = frame.get("line")
                            break
                    if not current_line_highlight and frames: # Fallback to top frame
                         current_line_highlight = frames[0].get("line")


            update_code_pane()
            layout["left_pane"].update(Panel(Text("\n").join(log_lines), title="LLM & MCP Log"))
            screen.update(layout)
            time.sleep(3)


        # --- Cleanup ---
        if current_mcp_session_id:
            send_mcp_request("close_debug_session", {"sessionId": current_mcp_session_id})
        
        stop_mcp_server()
        
        # Final update before exit
        update_code_pane()
        layout["left_pane"].update(Panel(Text("\n").join(log_lines), title="LLM & MCP Log"))
        screen.update(layout)
        CONSOLE.print("\nDemo finished. Press Ctrl+C if not exited.")
        # Keep screen alive for a bit to see final state in asciinema
        time.sleep(5)


if __name__ == "__main__":
    try:
        run_demo()
    except KeyboardInterrupt:
        print("\nDemo interrupted by user.")
    finally:
        if mcp_server_process and mcp_server_process.poll() is None:
            stop_mcp_server()
