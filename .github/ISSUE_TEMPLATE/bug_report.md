---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: debugmcp

---

## 🐛 Bug Description

A clear and concise description of what the bug is.

## 📋 Steps to Reproduce

1. Set up mcp-debugger with '...'
2. Run command '...'
3. Set breakpoint at '...'
4. See error

## 🤔 Expected Behavior

A clear and concise description of what you expected to happen.

## 💥 Actual Behavior

What actually happened instead.

## 📸 Screenshots/Logs

If applicable, add screenshots or debug logs to help explain your problem.

```
Paste any relevant error messages or logs here
```

## 🌍 Environment

- **OS**: [e.g., Windows 11, Ubuntu 22.04, macOS 13]
- **Node.js version**: [e.g., 20.11.0]
- **Python version**: [e.g., 3.11.5]
- **mcp-debugger version**: [e.g., 0.9.0]
- **Installation method**: [Docker/npm/built from source]
- **MCP client**: [e.g., Claude Desktop, custom client]

## 📝 Additional Context

Add any other context about the problem here. For example:
- Was this working before?
- Does it happen consistently?
- Any workarounds you've found?

## 🔍 Debug Information

<details>
<summary>Click to expand debug info</summary>

If possible, run with debug logging enabled and paste the output:

```bash
# For STDIO mode
DEBUG=* mcp-debugger

# For Docker
docker run -e DEBUG=* debugmcp/mcp-debugger:0.9.0
```

</details>
