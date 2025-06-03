# agent_demo.py
# A minimal demonstration of an "LLM agent" loop interacting with the debug-mcp-server.

import requests
import json
import time
import os
import uuid
import sys

MCP_SERVER_URL = "http://localhost:3000/mcp" # Default URL, ensure server is running

# --- MCP Interaction Helper (similar to debug_swap_demo.py) ---
def call_mcp_tool(tool_name: str, arguments: dict, mcp_session_id: str | None = None):
    headers = {"Content-Type": "application/json"}
    if mcp_session_id:
        headers["mcp-session-id"] = mcp_session_id
    
    payload = {
        "jsonrpc": "2.0",
        "method": "CallTool",
        "params": {"name": tool_name, "arguments": arguments},
        "id": f"agent-demo-{tool_name}-{uuid.uuid4()}"
    }
    
    print(f"\n[Agent -> MCP Server] Calling tool: {tool_name}, Args: {arguments}")
    response = requests.post(MCP_SERVER_URL, json=payload, headers=headers)
    response.raise_for_status()
    json_response = response.json()
    
    print(f"[MCP Server -> Agent] Response: {json.dumps(json_response, indent=2)}")
    
    if json_response.get("error"):
        raise Exception(f"MCP Server Error for {tool_name}: {json_response['error']}")
        
    tool_result_raw = json_response.get("result")
    processed_tool_result: dict | list | None = None
    if isinstance(tool_result_raw, str):
        try:
            processed_tool_result = json.loads(tool_result_raw)
        except json.JSONDecodeError:
            processed_tool_result = {"error": "result_is_unparseable_string", "raw_value": tool_result_raw}
    elif tool_result_raw is not None:
        processed_tool_result = tool_result_raw
    
    return processed_tool_result, response.headers.get("mcp-session-id")

# --- Mock LLM and Agent Loop ---
class MockLLM:
    def __init__(self):
        self.history = []
        self.plan = [
            {"tool": "create_debug_session", "args": {"language": "python", "name": "AgentDebugSession"}},
            # The agent needs to know the script path. For this demo, let's assume it figures it out or it's provided.
            # We'll use the swap_vars.py from the other example.
            {"tool": "set_breakpoint", "args": {"file": os.path.abspath("examples/python_simple_swap/swap_vars.py"), "line": 9}},
            {"tool": "start_debugging", "args": {"scriptPath": os.path.abspath("examples/python_simple_swap/swap_vars.py")}},
            {"tool": "get_stack_trace", "args": {}}, # Will need sessionId filled in
            # Add more steps if desired, e.g., get_scopes, get_variables, step_over
            {"tool": "close_debug_session", "args": {}}, # Will need sessionId
        ]
        self.current_step = 0
        self.debug_session_id: str | None = None
        self.mcp_http_session_id: str | None = None

    def think(self, observation: str | dict | None) -> tuple[str, dict] | None:
        """Simulates LLM thinking and deciding the next action."""
        self.history.append({"role": "assistant", "content": f"Received observation: {observation}"})
        
        if self.current_step >= len(self.plan):
            print("[LLM] Plan complete.")
            return None

        action = self.plan[self.current_step]
        tool_to_call = action["tool"]
        tool_args = action["args"].copy() # Use a copy to modify

        # Dynamically fill in sessionId if needed and available
        if "sessionId" not in tool_args and self.debug_session_id and \
           tool_to_call not in ["create_debug_session", "list_debug_sessions"]:
            tool_args["sessionId"] = self.debug_session_id
        
        # Special handling for set_breakpoint if file path needs to be absolute
        if tool_to_call == "set_breakpoint" and "file" in tool_args:
            if not os.path.isabs(tool_args["file"]):
                 # This demo assumes the script is relative to CWD or a known examples path
                 # For robustness, an agent would need better file path reasoning
                tool_args["file"] = os.path.abspath(tool_args["file"])
                print(f"[LLM] Resolved relative path for set_breakpoint: {tool_args['file']}")


        self.current_step += 1
        self.history.append({"role": "assistant", "content": f"Decided to call tool: {tool_to_call} with args: {tool_args}"})
        return tool_to_call, tool_args

def agent_loop():
    llm = MockLLM()
    observation = "Initial task: Debug the swap_vars.py script."

    max_iterations = 10
    for i in range(max_iterations):
        print(f"\n--- Agent Iteration {i+1} ---")
        print(f"[Agent] Current observation: {observation}")

        action = llm.think(observation)
        if action is None:
            print("[Agent] LLM decided to finish.")
            break

        tool_name, tool_args = action
        
        try:
            tool_result, new_mcp_http_session_id = call_mcp_tool(tool_name, tool_args, llm.mcp_http_session_id)
            
            if new_mcp_http_session_id and llm.mcp_http_session_id != new_mcp_http_session_id:
                print(f"[Agent] Updated MCP HTTP session ID to: {new_mcp_http_session_id}")
                llm.mcp_http_session_id = new_mcp_http_session_id

            observation = {"tool_name": tool_name, "result": tool_result}

            # Update LLM's state based on tool results
            if tool_name == "create_debug_session" and isinstance(tool_result, dict):
                llm.debug_session_id = tool_result.get("sessionId")
                print(f"[Agent] Stored new debug_session_id: {llm.debug_session_id}")
            
            if tool_name == "start_debugging" and isinstance(tool_result, dict) and tool_result.get("success"):
                print("[Agent] Debugging started. Waiting for breakpoint...")
                time.sleep(3) # Simulate waiting for breakpoint
                observation["additional_info"] = "Script is now paused at a breakpoint (assumed)."


        except Exception as e:
            print(f"[Agent] Error calling tool {tool_name}: {e}", file=sys.stderr)
            observation = {"tool_name": tool_name, "error": str(e)}
            # Optionally, allow LLM to retry or handle error
            # For this demo, we'll just feed the error back.

    print("\n--- Agent loop finished ---")
    if llm.debug_session_id and llm.current_step <= len(llm.plan) and \
       llm.plan[llm.current_step-1 if llm.current_step > 0 else 0]['tool'] != "close_debug_session":
        print(f"[Agent] Cleaning up potentially open debug session: {llm.debug_session_id}")
        try:
            call_mcp_tool("close_debug_session", {"sessionId": llm.debug_session_id}, llm.mcp_http_session_id)
        except Exception as e_close:
            print(f"[Agent] Error during cleanup close_debug_session: {e_close}", file=sys.stderr)


if __name__ == "__main__":
    # Ensure the target script for debugging exists
    swap_script = os.path.abspath("examples/python_simple_swap/swap_vars.py")
    if not os.path.exists(swap_script):
        print(f"ERROR: The target script {swap_script} does not exist.", file=sys.stderr)
        print("Please ensure 'examples/python_simple_swap/swap_vars.py' is present.", file=sys.stderr)
        sys.exit(1)

    print("Ensure the debug-mcp-server is running on " + MCP_SERVER_URL)
    print(f"This agent demo will attempt to debug: {swap_script}")
    input("Press Enter to start the agent demo...")
    agent_loop()
