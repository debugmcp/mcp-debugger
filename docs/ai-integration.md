# AI Integration Guide

This guide explains how AI agents can leverage the enhanced features of mcp-debugger v0.12.0 for more intelligent debugging operations.

## Overview

The mcp-debugger v0.12.0 introduces several AI-friendly features that enable agents to make smarter decisions about debugging operations:

1. **Path Validation** - Prevents crashes and provides clear error messages
2. **Line Context in Breakpoints** - Shows code context for intelligent breakpoint placement
3. **Source Context Tool** - Explore code without setting breakpoints

## Key Features for AI Agents

### 1. Intelligent Breakpoint Placement

With line context, AI agents can now see what type of line they're setting breakpoints on:

```json
// Response from set_breakpoint
{
  "success": true,
  "breakpointId": "28e06119-619e-43c0-b029-339cec2615df",
  "file": "C:\\path\\to\\script.py",
  "line": 15,
  "verified": false,
  "message": "Breakpoint set at script.py:15",
  "context": {
    "lineContent": "    # This is a comment",
    "surrounding": [
      { "line": 13, "content": "def calculate_sum(a, b):" },
      { "line": 14, "content": "    \"\"\"Calculate sum of two numbers\"\"\"" },
      { "line": 15, "content": "    # This is a comment" },
      { "line": 16, "content": "    result = a + b  # This is executable" },
      { "line": 17, "content": "    return result" }
    ]
  }
}
```

**AI Decision Making**:
- Avoid setting breakpoints on comments (line 15)
- Prefer executable lines (line 16)
- Understand function structure from context

### 2. Path Validation for Robustness

No more cryptic crashes! AI agents get immediate, clear feedback:

```json
// Error from set_breakpoint on non-existent file
{
  "code": -32602,
  "message": "File not found: 'test.py'\nResolved path: 'C:\\workspace\\test.py'\nContainer mode: false\nSuggestion: Check that the file exists and the path is correct\nNote: Relative paths are resolved from: C:\\workspace"
}
```

**Benefits**:
- Clear error messages instead of crashes
- Shows exactly where paths resolve to
- Helps AI understand the working directory context

### 3. Code Exploration with get_source_context

AI agents can now explore code without debugging:

```json
// Request
{
  "sessionId": "session-id",
  "file": "complex_algorithm.py",
  "line": 50,
  "linesContext": 10
}

// Response shows 10 lines before and after line 50
{
  "success": true,
  "file": "complex_algorithm.py",
  "line": 50,
  "lineContent": "    result = process_data(input_data)",
  "surrounding": [
    // ... 10 lines before ...
    { "line": 50, "content": "    result = process_data(input_data)" },
    // ... 10 lines after ...
  ]
}
```

**Use Cases**:
- Understand code structure before debugging
- Find appropriate locations for breakpoints
- Navigate complex codebases efficiently

## Best Practices for AI Agents

### 1. Breakpoint Strategy

```python
# Good: Check context before setting breakpoint
response = set_breakpoint(file="script.py", line=10)
if "# " in response["context"]["lineContent"]:
    # This is a comment, try the next line
    response = set_breakpoint(file="script.py", line=11)
```

### 2. Path Handling

```python
# Good: Use absolute paths when possible
set_breakpoint(file="C:/projects/myapp/src/main.py", line=20)

# Also good: Handle path errors gracefully
try:
    set_breakpoint(file="main.py", line=20)
except McpError as e:
    if "File not found" in str(e):
        # Extract resolved path from error message
        # Try with correct path
```

### 3. Code Navigation

```python
# Explore before debugging
context = get_source_context(file="module.py", line=100, linesContext=20)

# Analyze the context
for line_info in context["surrounding"]:
    if "def " in line_info["content"]:
        # Found a function definition
    elif line_info["content"].strip() and not line_info["content"].strip().startswith("#"):
        # Found an executable line
```

## Example: Smart Debugging Session

Here's how an AI agent can use these features together:

```python
# 1. Create session
session = create_debug_session(language="python", name="Smart Debug")

# 2. Explore the code first
context = get_source_context(
    sessionId=session["sessionId"],
    file="buggy_code.py",
    line=50,
    linesContext=15
)

# 3. Find good breakpoint locations
good_lines = []
for line_info in context["surrounding"]:
    content = line_info["content"].strip()
    if content and not content.startswith("#") and not content.startswith('"""'):
        good_lines.append(line_info["line"])

# 4. Set breakpoints intelligently
for line_num in good_lines[:3]:  # Set up to 3 breakpoints
    bp_response = set_breakpoint(
        sessionId=session["sessionId"],
        file="buggy_code.py",
        line=line_num
    )
    print(f"Breakpoint at line {line_num}: {bp_response['context']['lineContent']}")

# 5. Start debugging
start_debugging(
    sessionId=session["sessionId"],
    scriptPath="buggy_code.py"
)
```

## Common Patterns

### Pattern 1: Skip Non-Executable Lines

```python
def find_next_executable_line(session_id, file, start_line):
    """Find the next executable line after start_line"""
    for offset in range(0, 10):  # Check next 10 lines
        response = set_breakpoint(
            sessionId=session_id,
            file=file,
            line=start_line + offset
        )
        
        if response.get("success"):
            content = response["context"]["lineContent"].strip()
            # Skip comments, docstrings, and blank lines
            if content and not content.startswith("#") and not content.startswith('"""'):
                return start_line + offset
    
    return None
```

### Pattern 2: Validate Before Debugging

```python
def safe_start_debugging(session_id, script_path):
    """Validate file exists before starting debug session"""
    # Try to get source context to validate file exists
    try:
        get_source_context(
            sessionId=session_id,
            file=script_path,
            line=1,
            linesContext=0
        )
        # File exists, safe to start debugging
        return start_debugging(sessionId=session_id, scriptPath=script_path)
    except McpError as e:
        if "File not found" in str(e):
            return {"error": f"Cannot debug: {script_path} not found"}
        raise
```

### Pattern 3: Context-Aware Stepping

```python
def smart_step_over(session_id):
    """Step over with context awareness"""
    # Get current position
    stack = get_stack_trace(sessionId=session_id)
    current_frame = stack["stackFrames"][0]
    
    # Get context around current line
    context = get_source_context(
        sessionId=session_id,
        file=current_frame["file"],
        line=current_frame["line"],
        linesContext=2
    )
    
    # Decide whether to step over or into based on context
    current_line = context["lineContent"]
    if "important_function(" in current_line:
        # Step into important functions
        return step_into(sessionId=session_id)
    else:
        # Step over regular lines
        return step_over(sessionId=session_id)
```

## Summary

The v0.12.0 improvements make mcp-debugger significantly more AI-friendly:

- **No more crashes** from missing files
- **Intelligent breakpoint placement** with line context
- **Code exploration** without debugging
- **Clear error messages** for better decision making

These features enable AI agents to debug more effectively, with fewer errors and better understanding of the code being debugged.
