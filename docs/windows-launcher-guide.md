# Windows Launcher Guide

This guide provides detailed information about different launcher approaches for Windows and how to troubleshoot "spawn EINVAL" errors.

## Understanding "spawn EINVAL" Errors

The "spawn EINVAL" error in Node.js typically indicates that there's an invalid argument when trying to spawn a child process. When this occurs with an MCP server, it's often related to:

1. Spaces in file paths
2. Incorrect path formatting
3. Command syntax issues
4. Working directory problems

## Launcher Options

We've created several alternative launchers to address potential issues. Here's a comparison of the different approaches:

### 1. Simple Batch Script (`simple-run.cmd`)

```batch
@echo off
REM Simple wrapper script that changes to the correct directory first
cd /d "%~dp0"
node dist\index.js stdio
```

**Benefits**:
- Changes to the project directory first, avoiding path issues
- Very simple and straightforward

### 2. JavaScript Launcher (`direct-launch.js`)

```javascript
#!/usr/bin/env node
try {
  console.log('Starting Debug MCP Server via direct launcher...');
  import('./dist/index.js')
    .then(() => {
      console.log('Server loaded successfully');
    })
    .catch(error => {
      console.error('Failed to load server module:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('Launcher error:', error);
  process.exit(1);
}
```

**Benefits**:
- Avoids command-line path handling completely
- Uses native JavaScript import mechanism

### 3. PowerShell Script (`mcp-launcher.ps1`)

```powershell
# PowerShell launcher for Debug MCP Server
# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# Build the full path to the index.js file
$indexPath = Join-Path -Path $scriptDir -ChildPath "dist\index.js"
# Run the server
try {
    & node $indexPath stdio
} catch {
    Write-Error "Error running node: $_"
    exit 1
}
```

**Benefits**:
- PowerShell has better path handling for complex paths
- Error handling is more robust

### 4. Traditional Batch Script (`run-debug-server.cmd`)

```batch
@echo off
REM Debug MCP Server Launcher
SET SCRIPT_DIR=%~dp0
SET INDEX_PATH=%SCRIPT_DIR%dist\index.js
REM Remove any trailing slash from the path
IF %SCRIPT_DIR:~-1%==\ SET SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
ECHO Starting Debug MCP Server...
ECHO Using script path: %INDEX_PATH%
REM Run the server with any arguments passed to this script
node "%INDEX_PATH%" stdio %*
```

**Benefits**:
- Explicit path handling
- Shows path information for debugging
- Passes through additional arguments

## Configuration in MCP Settings

When configuring your MCP settings file:

1. **Simple Path (Recommended)**:
```json
"command": "C:\\path\\to\\mcp-debugger\\simple-run.cmd"
```

2. **With Quotes (For complex paths)**:
```json
"command": "\"C:\\Program Files\\mcp-debugger\\run-debug-server.cmd\""
```

3. **Direct node invocation**:
```json
"command": "node \"C:\\workspace\\mcp-debugger\\direct-launch.js\""
```

## Troubleshooting Approach

If you encounter "spawn EINVAL" or similar errors:

1. Test each launcher manually in a command prompt before using it in MCP settings
2. Try running the server directly: `node dist/index.js stdio`
3. Use backslashes instead of forward slashes in your paths
4. Try different quoting styles
5. Check your current working directory with `echo %cd%`

## Testing the Launcher

Run your chosen launcher script from the command line first to verify it works before configuring it in the MCP settings.
