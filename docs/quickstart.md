# Quickstart: debug-mcp-server

This guide will help you get started with `debug-mcp-server` quickly.

## Prerequisites

- For Docker: Docker installed and running.
- For Node.js/npx: Node.js (v16+) and npm installed.
- For Python debugging: Python (3.8+) and `debugpy` installed in the target Python environment. (The `debug-mcp-server-launcher` PyPI package can help ensure `debugpy` is available).

## Running the Server

There are several ways to run the `debug-mcp-server`:

### 1. Using Docker (Recommended)

This is the easiest way to get started.

- **Pull the latest image:**
  ```bash
  docker pull debugmcp/debug-mcp-server:latest
  ```
  *(Note: Replace `debugmcp/debug-mcp-server` with the correct Docker Hub repository if different.)*

- **Run the server:**
  The server listens on port 3000 by default for MCP commands.
  ```bash
  docker run -p 3000:3000 debugmcp/debug-mcp-server:latest
  ```
  You can pass command-line arguments to the server inside the Docker container if needed:
  ```bash
  docker run -p 3000:3000 debugmcp/debug-mcp-server:latest http --port 3000 --log-level info
  ```

### 2. Using NPX (Requires Node.js & npm)

If the `mcp-debugger` package is published to npm, you can run it directly using `npx`:

```bash
npx mcp-debugger http --port 3000
```
*(This assumes the `mcp-debugger` package name on npm. Adjust if different.)*

### 3. Running from Cloned Repository (Requires Node.js & npm)

- **Clone the repository:**
  ```bash
  git clone https://github.com/your-repo/debug-mcp-server.git 
  cd debug-mcp-server
  ```
  *(Note: Replace with the actual repository URL.)*

- **Install dependencies:**
  ```bash
  npm install
  ```

- **Run the server:**
  ```bash
  npm start -- http --port 3000 
  ```
  Or for development with auto-reloading (using `ts-node`):
  ```bash
  npm run dev -- http --port 3000
  ```

## Agent Integration Example (Conceptual LangChain Tool)

Here's a conceptual example of how you might integrate `debug-mcp-server` tools into an AI agent framework like LangChain. This assumes the `debug-mcp-server` is running and accessible at `http://localhost:3000`.

```python
from langchain_core.tools import BaseTool
from typing import Type, Any
from pydantic import BaseModel, Field
import requests # Or any HTTP client library

# --- Define Pydantic models for tool inputs ---
class CreateDebugSessionInput(BaseModel):
    language: str = Field(description="The programming language of the script to debug (e.g., 'python').")
    name: str = Field(description="A descriptive name for the debug session.")

class SetBreakpointInput(BaseModel):
    sessionId: str = Field(description="The ID of the debug session.")
    file: str = Field(description="The absolute path to the file where the breakpoint should be set.")
    line: int = Field(description="The line number for the breakpoint.")

class StartDebuggingInput(BaseModel):
    sessionId: str = Field(description="The ID of the debug session.")
    scriptPath: str = Field(description="The absolute path to the script to start debugging.")
    args: list[str] = Field(default_factory=list, description="Optional arguments for the script.")

# ... (add more input models for other tools like step_over, get_variables, etc.)

class DebugMCPTool(BaseTool):
    name: str = "DebugMCPTool" # Generic name, specific tools below
    description: str = "A tool to interact with the Debug MCP Server."
    # args_schema: Type[BaseModel] = None # This will be set by specific tools

    _mcp_server_url: str = "http://localhost:3000/mcp" # Configurable

    def _make_mcp_request(self, method_name: str, params: dict, mcp_session_id: str = None) -> Any:
        headers = {"Content-Type": "application/json"}
        if mcp_session_id:
            headers["mcp-session-id"] = mcp_session_id
        
        payload = {
            "jsonrpc": "2.0",
            "method": "CallTool", # MCP SDK's CallTool method
            "params": {
                "name": method_name, # The actual MCP tool name
                "arguments": params
            },
            "id": "langchain-tool-request" # A unique ID
        }
        try:
            response = requests.post(self._mcp_server_url, json=payload, headers=headers)
            response.raise_for_status()
            json_response = response.json()
            if json_response.get("error"):
                raise Exception(f"MCP Server Error: {json_response['error']}")
            # The actual tool result is in json_response['result']
            # It might be a JSON string itself, requiring another parse
            return json_response.get("result") 
        except requests.RequestException as e:
            return f"HTTP Request Error: {e}"
        except Exception as e:
            return f"Error processing MCP response: {e}"

    def _run(self, *args: Any, **kwargs: Any) -> Any:
        # This base tool shouldn't be called directly.
        # Subclasses will implement this.
        raise NotImplementedError("This base tool should not be called directly.")

# --- Specific Tool Implementations ---

class CreateDebugSessionTool(DebugMCPTool):
    name: str = "create_debug_session"
    description: str = "Creates a new debug session for a specified language."
    args_schema: Type[BaseModel] = CreateDebugSessionInput

    def _run(self, language: str, name: str) -> Any:
        return self._make_mcp_request(self.name, {"language": language, "name": name})

class SetBreakpointTool(DebugMCPTool):
    name: str = "set_breakpoint"
    description: str = "Sets a breakpoint in a file for a given debug session."
    args_schema: Type[BaseModel] = SetBreakpointInput

    def _run(self, sessionId: str, file: str, line: int) -> Any:
        # Assuming the MCP session ID is managed externally or passed via run_manager
        # For simplicity, not handling mcp-session-id header here, but a real tool would.
        return self._make_mcp_request(self.name, {"sessionId": sessionId, "file": file, "line": line})
        
class StartDebuggingTool(DebugMCPTool):
    name: str = "start_debugging"
    description: str = "Starts debugging a script in the specified session."
    args_schema: Type[BaseModel] = StartDebuggingInput

    def _run(self, sessionId: str, scriptPath: str, args: list[str] = None) -> Any:
        params = {"sessionId": sessionId, "scriptPath": scriptPath}
        if args:
            params["args"] = args
        return self._make_mcp_request(self.name, params)

# Example usage (conceptual)
# tools = [CreateDebugSessionTool(), SetBreakpointTool(), StartDebuggingTool()]
# agent = initialize_agent(tools, llm, agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION, verbose=True)
# agent.run("Create a Python debug session named 'my_test', set a breakpoint at line 5 of 'myscript.py', then start debugging it.")
```

This example provides a basic structure. A real LangChain integration would involve more robust error handling, managing the `mcp-session-id` for HTTP sessions, and potentially more sophisticated parsing of tool responses.
The `debug-mcp-server` also supports a STDIN/STDOUT transport which might be preferable for some agent integrations if running the server as a subprocess.

---

For more detailed API documentation and advanced usage, please refer to the main project [README.md](../README.md) and other documents in this `docs` folder.
