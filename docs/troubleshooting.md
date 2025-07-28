# Troubleshooting Guide

This guide provides solutions for common issues you might encounter when setting up and using the Debug MCP Server.

## Connection Issues

### MCP Server Shows "Disconnected" in VS Code

**Problem**: The debug-mcp-server shows as disconnected in the Claude VS Code extension.

**Solutions**:

1. Verify the command path in your MCP settings:
   ```json
   "command": "C:\\path\\to\\debug-mcp-server\\run-debug-server.cmd"
   ```
   Ensure this points to the correct location of your script.

2. Check for spaces in file paths:
   - Windows paths with spaces require proper quoting
   - Try using the absolute path with double quotes in the CMD script

3. Run the server manually to see errors:
   - Open a terminal
   - Navigate to the project directory
   - Run: `.\run-debug-server.cmd`
   - Check for any error messages

4. Restart VS Code:
   - Sometimes a simple restart of VS Code can resolve connection issues

### ENOENT Error When Starting Server

**Problem**: You see an error like: `spawn node c:/path/to/debug-mcp-server/dist/index.js ENOENT`

**Solutions**:

1. Check if the path exists:
   - Verify that the dist directory and index.js file exist
   - Run `npm run build` if the dist folder is missing

2. Fix path formatting:
   - Windows paths might need backslashes instead of forward slashes
   - Try modifying the run-debug-server.cmd file to use `%~dp0` for the current directory
   - Ensure `cline_mcp_settings.json` (or equivalent) point to the correct path for `dist/index.js`.

3. Use quotes for paths with spaces:
   - If your path contains spaces, ensure it's properly quoted in the command

## Python Issues

### Python Not Found

**Problem**: The server can't find a Python installation.

**Solutions**:

1. Check if Python is installed and in PATH:
   ```
   python --version
   ```

2. Set the PYTHON_PATH environment variable:
   - Windows: `set PYTHON_PATH=C:\path\to\python.exe`
   - Unix: `export PYTHON_PATH=/path/to/python`

3. Specify Python path directly in the debug session:
   - When creating a debug session through Claude, specify the executablePath

### debugpy Not Found or Installation Fails

**Problem**: The server can't find debugpy or fails to install it.

**Solutions**:

1. Install debugpy manually:
   ```
   pip install debugpy
   ```

2. Check pip installation:
   ```
   pip --version
   ```

3. Try installing with Python module syntax:
   ```
   python -m pip install debugpy
   ```

4. Check for permissions issues:
   - On Unix systems, you might need sudo
   - On Windows, try running as Administrator

## Path Resolution

### Understanding How Paths Are Resolved

**Problem**: File paths in debugging tools are resolved differently depending on your MCP client.

**Key Concept**: File paths are resolved relative to your MCP client's working directory, not the debugger's location.

**Solutions by Client**:

1. **VS Code with Cline**:
   - Paths resolve from VS Code's working directory
   - Check your workspace folder in VS Code
   - Example: If VS Code is open in `C:\projects\myapp`, then `test.py` resolves to `C:\projects\myapp\test.py`

2. **Claude Desktop**:
   - Paths resolve from the desktop client's directory
   - This may vary by OS and installation method

3. **Other MCP Clients**:
   - Check your client's documentation for working directory behavior

**Best Practices**:

1. **Use Absolute Paths**: To avoid confusion, always use absolute paths:
   ```json
   {
     "file": "C:/Users/user/projects/myapp/test.py",
     "line": 10
   }
   ```

2. **Check Error Messages**: The debugger now provides helpful context in errors:
   ```
   File not found: 'test.py'
   Resolved path: 'C:\Users\user\AppData\Local\Programs\Microsoft VS Code\test.py'
   Container mode: false
   Suggestion: Check that the file exists and the path is correct
   Note: Relative paths are resolved from: C:\Users\user\AppData\Local\Programs\Microsoft VS Code
   ```

3. **Container Mode**: When running in Docker, paths are prefixed with `/workspace/`:
   - Host: `test.py` → Container: `/workspace/test.py`
   - The debugger handles this translation automatically

## Debugging Session Issues

### Breakpoints Not Hit

**Problem**: Debugging starts, but breakpoints are never hit.

**Solutions**:

1. Verify breakpoint is set in the correct file:
   - Use absolute paths when setting breakpoints
   - Check file paths in Claude's responses

2. Check breakpoint verification:
   - Claude should report if a breakpoint was "verified"
   - Unverified breakpoints won't work

3. Make sure script execution reaches the breakpoint:
   - Set breakpoints in code paths that are definitely executed
   - Add a breakpoint at the script entry point to confirm debugging works

### Session Creation Fails

**Problem**: Unable to create a debug session.

**Solutions**:

1. Check server logs for errors:
   - Logs should show why session creation failed

2. Verify Python detection is working:
   - Server logs will show if Python was detected
   - Make sure Python is in PATH or specified via PYTHON_PATH

3. Ensure debugpy communication works:
   - Port conflicts can cause issues (default: 5678)
   - Check if another process is using the same port

## Communication Issues

### Claude Can't Connect to Debugging Session

**Problem**: Claude successfully starts the debug server but can't communicate with it properly.

**Solutions**:

1. Restart the conversation:
   - Sometimes a fresh conversation helps

2. Verify all tools are registered properly:
   - Check the server logs to see if all tools are registered
   - Make sure the server is up and running

3. Try a simple command first:
   - Start with listing debug sessions
   - Then create a debug session
   - Gradually build up to more complex operations

If you encounter an issue not covered in this guide, check:
1. The server logs for specific error messages
2. The VS Code output panel for Claude extension logs
3. Any error responses directly from Claude when using debugging commands
