# debug_swap_demo.py
# A script to demonstrate debugging swap_vars.py using the debug-mcp-server.

import requests
import json
import time
import os
import uuid
import sys # Import the sys module

MCP_SERVER_URL = "http://localhost:3000/mcp" # Default URL, ensure server is running

# Get the absolute path to swap_vars.py in the same directory
SWAP_SCRIPT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "swap_vars.py"))

def call_mcp_tool(tool_name: str, arguments: dict, mcp_session_id: str | None = None, request_id_suffix: str = ""):
    """Helper function to call an MCP tool."""
    headers = {"Content-Type": "application/json"}
    if mcp_session_id:
        headers["mcp-session-id"] = mcp_session_id
    
    payload = {
        "jsonrpc": "2.0",
        "method": "CallTool",
        "params": {
            "name": tool_name,
            "arguments": arguments
        },
        "id": f"debug-swap-demo-{tool_name}-{request_id_suffix}{uuid.uuid4()}"
    }
    
    print(f"\n[MCP Call] Tool: {tool_name}, Args: {arguments}")
    response = requests.post(MCP_SERVER_URL, json=payload, headers=headers)
    response.raise_for_status() # Raise an exception for HTTP errors
    
    json_response = response.json()
    print(f"[MCP Response] Body: {json.dumps(json_response, indent=2)}")
    
    if json_response.get("error"):
        raise Exception(f"MCP Server Error for {tool_name}: {json_response['error']}")
        
    # The actual tool result is in json_response['result']
    tool_result_raw = json_response.get("result")
    processed_tool_result: dict | list | None = None

    if isinstance(tool_result_raw, str):
        try:
            processed_tool_result = json.loads(tool_result_raw)
        except json.JSONDecodeError:
            print(f"[Warning] Tool result for {tool_name} was a string but not valid JSON: {tool_result_raw}")
            # Return a dict indicating the issue, or raise an error
            processed_tool_result = {"error": "result_is_unparseable_string", "raw_value": tool_result_raw}
    elif tool_result_raw is not None: # Could be dict, list, bool, number
        processed_tool_result = tool_result_raw
    else: # tool_result_raw is None (result key was missing or null)
        processed_tool_result = None # Explicitly None if no result

    # Extract mcp-session-id from response headers if present
    response_mcp_session_id = response.headers.get("mcp-session-id")
    
    return processed_tool_result, response_mcp_session_id

def run_debug_session():
    mcp_http_session_id: str | None = None
    debug_session_id = None

    try:
        # 1. Initialize MCP HTTP Session (optional, but good practice if server manages sessions per HTTP client)
        # For some MCP servers, the first call might establish a session.
        # Let's assume we can make a simple call or the server handles it.
        # For this demo, we'll let the first create_debug_session establish it if needed.

        # 2. Create a debug session
        print(f"\n--- Creating debug session for {SWAP_SCRIPT_PATH} ---")
        tool_result, mcp_http_session_id = call_mcp_tool(
            "create_debug_session", 
            {"language": "python", "name": "SwapDemoSession"},
            request_id_suffix="create-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from create_debug_session, got {type(tool_result)}: {tool_result}")
        debug_session_id = tool_result.get("sessionId")
        if not debug_session_id:
            raise ValueError(f"Failed to get sessionId from create_debug_session result: {tool_result}")
        print(f"Debug session created with ID: {debug_session_id}")
        print(f"MCP HTTP session ID: {mcp_http_session_id}")


        # 3. Set a breakpoint (e.g., at the line 'a = b')
        print("\n--- Setting breakpoint ---")
        # Line numbers are 1-based. Let's set it at line 9: `a = b`
        breakpoint_line = 9 
        tool_result, _ = call_mcp_tool(
            "set_breakpoint",
            {"sessionId": debug_session_id, "file": SWAP_SCRIPT_PATH, "line": breakpoint_line},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="setbp-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from set_breakpoint, got {type(tool_result)}: {tool_result}")
        assert tool_result.get("verified") or tool_result.get("breakpointId"), f"Breakpoint not verified or ID missing in result: {tool_result}"


        # 4. Start debugging (this will run the script until the breakpoint)
        print("\n--- Starting debugging ---")
        tool_result, _ = call_mcp_tool(
            "start_debugging",
            {"sessionId": debug_session_id, "scriptPath": SWAP_SCRIPT_PATH},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="start-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from start_debugging, got {type(tool_result)}: {tool_result}")
        assert tool_result.get("success"), f"Start debugging was not successful: {tool_result}"
        
        print("Waiting for script to hit breakpoint (allow a few seconds)...")
        time.sleep(3) # Give time for script to start and hit breakpoint

        # 5. Get stack trace to find the current frame
        print("\n--- Getting stack trace ---")
        tool_result, _ = call_mcp_tool(
            "get_stack_trace",
            {"sessionId": debug_session_id},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="stack-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from get_stack_trace, got {type(tool_result)}: {tool_result}")
        stack_frames = tool_result.get("stackFrames", [])
        if not stack_frames:
            raise ValueError(f"No stack frames found. Did the breakpoint hit? Result: {tool_result}")
        
        frame_zero = stack_frames[0] # Assuming stack_frames is a list of dicts
        if not isinstance(frame_zero, dict):
             raise ValueError(f"Expected stack frame to be a dict, got {type(frame_zero)}: {frame_zero}")
        current_frame_id = frame_zero.get("id")
        current_line = frame_zero.get("line")
        if current_frame_id is None or current_line is None:
            raise ValueError(f"First stack frame is missing 'id' or 'line': {frame_zero}")
        print(f"Current frame ID: {current_frame_id}, stopped at line: {current_line}")
        assert current_line == breakpoint_line, f"Stopped at line {current_line}, expected {breakpoint_line}"


        # 6. Get scopes for the current frame
        print("\n--- Getting scopes ---")
        tool_result, _ = call_mcp_tool(
            "get_scopes",
            {"sessionId": debug_session_id, "frameId": current_frame_id},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="scopes-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from get_scopes, got {type(tool_result)}: {tool_result}")
        scopes = tool_result.get("scopes", [])
        if not isinstance(scopes, list):
            raise ValueError(f"Expected scopes to be a list, got {type(scopes)}: {scopes}")
        locals_scope_dict = next((s for s in scopes if isinstance(s, dict) and s.get("name") == "Locals"), None)
        if not locals_scope_dict: # Also implies it's a dict
            raise ValueError(f"Locals scope not found in scopes: {scopes}")
        locals_vars_ref = locals_scope_dict.get("variablesReference")
        if locals_vars_ref is None:
            raise ValueError(f"Locals scope is missing 'variablesReference': {locals_scope_dict}")
        print(f"Locals scope variablesReference: {locals_vars_ref}")


        # 7. Get variables from the 'Locals' scope
        print("\n--- Getting variables (before 'a = b' execution) ---")
        tool_result, _ = call_mcp_tool(
            "get_variables",
            {"sessionId": debug_session_id, "scope": locals_vars_ref},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="vars1-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from get_variables, got {type(tool_result)}: {tool_result}")
        variables = tool_result.get("variables", [])
        if not isinstance(variables, list):
            raise ValueError(f"Expected variables to be a list, got {type(variables)}: {variables}")
        print("Variables:")
        for var_item in variables:
            if not isinstance(var_item, dict):
                print(f"  Skipping non-dict variable item: {var_item}")
                continue
            var_name = var_item.get('name', 'UnknownVar')
            var_value = var_item.get('value', 'UnknownValue')
            var_type = var_item.get('type', 'UnknownType')
            print(f"  {var_name} = {var_value} (type: {var_type})")
        
        var_a = next((v for v in variables if isinstance(v,dict) and v.get('name') == 'a'), None)
        var_b = next((v for v in variables if isinstance(v,dict) and v.get('name') == 'b'), None)
        assert var_a and isinstance(var_a, dict) and var_a.get('value') == '10', f"Variable 'a' should be 10 before the line, got: {var_a}"
        assert var_b and isinstance(var_b, dict) and var_b.get('value') == '20', f"Variable 'b' should be 20 before the line, got: {var_b}"


        # 8. Step over the line 'a = b'
        print("\n--- Stepping over (executing 'a = b') ---")
        tool_result, _ = call_mcp_tool(
            "step_over",
            {"sessionId": debug_session_id},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="step1-"
        )
        print("Step over complete. Waiting for debugger to settle...")
        time.sleep(1) # Give time for step to complete


        # 9. Get variables again to see the change in 'a'
        print("\n--- Getting variables (after 'a = b' execution) ---")
        # Need to get stack/scopes again as they might have changed or references invalidated
        tool_result, _ = call_mcp_tool("get_stack_trace", {"sessionId": debug_session_id}, mcp_http_session_id, request_id_suffix="stack2-")
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from get_stack_trace (after step), got {type(tool_result)}: {tool_result}")
        stack_frames_after_step = tool_result.get("stackFrames", [])
        if not stack_frames_after_step or not isinstance(stack_frames_after_step[0], dict):
             raise ValueError(f"Invalid stack_frames after step: {stack_frames_after_step}")
        frame_zero_after_step = stack_frames_after_step[0]
        current_frame_id_after_step = frame_zero_after_step.get("id")
        if current_frame_id_after_step is None:
            raise ValueError(f"Frame ID missing after step: {frame_zero_after_step}")
            
        tool_result, _ = call_mcp_tool("get_scopes", {"sessionId": debug_session_id, "frameId": current_frame_id_after_step}, mcp_http_session_id, request_id_suffix="scopes2-")
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from get_scopes (after step), got {type(tool_result)}: {tool_result}")
        scopes_after_step = tool_result.get("scopes", [])
        if not isinstance(scopes_after_step, list):
            raise ValueError(f"Expected scopes to be a list (after step), got {type(scopes_after_step)}: {scopes_after_step}")
        locals_scope_dict_after_step = next((s for s in scopes_after_step if isinstance(s, dict) and s.get("name") == "Locals"), None)
        if not locals_scope_dict_after_step:
             raise ValueError(f"Locals scope not found after step: {scopes_after_step}")
        locals_vars_ref_after_step = locals_scope_dict_after_step.get("variablesReference")
        if locals_vars_ref_after_step is None:
            raise ValueError(f"Locals scope variablesReference missing after step: {locals_scope_dict_after_step}")

        tool_result, _ = call_mcp_tool(
            "get_variables",
            {"sessionId": debug_session_id, "scope": locals_vars_ref_after_step},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="vars2-"
        )
        if not isinstance(tool_result, dict):
            raise ValueError(f"Expected dict result from get_variables (after step), got {type(tool_result)}: {tool_result}")
        variables_after_step = tool_result.get("variables", [])
        if not isinstance(variables_after_step, list):
            raise ValueError(f"Expected variables to be a list (after step), got {type(variables_after_step)}: {variables_after_step}")
        print("Variables:")
        for var_item in variables_after_step:
            if not isinstance(var_item, dict):
                print(f"  Skipping non-dict variable item: {var_item}")
                continue
            var_name = var_item.get('name', 'UnknownVar')
            var_value = var_item.get('value', 'UnknownValue')
            var_type = var_item.get('type', 'UnknownType')
            print(f"  {var_name} = {var_value} (type: {var_type})")
        
        var_a_after = next((v for v in variables_after_step if isinstance(v,dict) and v.get('name') == 'a'), None)
        assert var_a_after and isinstance(var_a_after, dict) and var_a_after.get('value') == '20', f"Variable 'a' should be 20 after 'a = b', got: {var_a_after}"


        # 10. Continue execution to finish the script
        print("\n--- Continuing execution ---")
        tool_result, _ = call_mcp_tool(
            "continue_execution",
            {"sessionId": debug_session_id},
            mcp_session_id=mcp_http_session_id,
            request_id_suffix="continue-"
        )
        print("Continue execution called. Script should finish.")
        time.sleep(2) # Allow script to finish

        print("\n--- Debug session demonstration complete ---")

    except Exception as e:
        print(f"\nAn error occurred: {e}", file=sys.stderr)
    finally:
        if debug_session_id:
            print(f"\n--- Closing debug session: {debug_session_id} ---")
            try:
                call_mcp_tool(
                    "close_debug_session", 
                    {"sessionId": debug_session_id},
                    mcp_session_id=mcp_http_session_id, # Use the established MCP HTTP session ID
                    request_id_suffix="close-"
                )
                print("Debug session closed.")
            except Exception as e_close:
                print(f"Error closing debug session: {e_close}", file=sys.stderr)

if __name__ == "__main__":
    print("Ensure the debug-mcp-server is running on " + MCP_SERVER_URL)
    print("This script will attempt to debug:", SWAP_SCRIPT_PATH)
    input("Press Enter to start the demo...")
    run_debug_session()
