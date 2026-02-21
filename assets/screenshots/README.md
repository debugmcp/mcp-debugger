# MCP Debugger Screenshots

This directory contains authentic screenshots demonstrating the mcp-debugger visualizer in action. All screenshots are captured from real debugging sessions - no mock data or staging.

## Screenshots

### debugging-session.png
- **Description**: Active debugging session paused at a breakpoint
- **Key Features**: 
  - Breakpoint marker (●) at lines 10-11 of swap_vars.py
  - Current line indicator (→) showing where execution is paused
  - Stack trace visible in the tool panel
  - Real debugpy session communicating through MCP protocol
- **Dimensions**: 1200x800 (recommended)
- **Max Size**: 200KB

### variable-inspection.png
- **Description**: Variable inspection revealing the swap bug
- **Key Features**: 
  - Variables panel showing the bug: both a=20, b=20 after lines 10-11
  - This is the actual bug in swap_vars.py (not a mock)
  - get_variables tool response with real data
  - Tool activity log showing the debugging flow
- **Dimensions**: 1200x800 (recommended)
- **Max Size**: 200KB

### mcp-integration.png
- **Description**: MCP protocol integration showing real communication
- **Key Features**: 
  - tool:call entries with actual MCP request format
  - tool:response entries with structured JSON data
  - Real protocol messages between client and server
  - No prettifying - raw authentic communication
- **Dimensions**: 1200x800 (recommended)
- **Max Size**: 200KB

### multi-session.png
- **Description**: Multiple concurrent debugging sessions
- **Key Features**: 
  - list_debug_sessions output showing multiple active sessions
  - Real session IDs and descriptive names
  - Demonstrates session management capabilities
  - Each session is a real debugpy instance
- **Dimensions**: 1200x800 (recommended)
- **Max Size**: 200KB

## Usage in Documentation

### Markdown
```markdown
![Debugging Session](assets/screenshots/debugging-session.png)
*Active debugging session with breakpoint and current line indicators*

![Variable Inspection](assets/screenshots/variable-inspection.png)
*Variable inspection revealing the swap bug where both variables become 20*

![MCP Integration](assets/screenshots/mcp-integration.png)
*Real MCP protocol communication between client and debugger*

![Multi-session Support](assets/screenshots/multi-session.png)
*Multiple concurrent debugging sessions managed by the MCP server*
```

### HTML
```html
<figure>
  <img src="assets/screenshots/debugging-session.png" 
       alt="Active debugging session with breakpoint" 
       width="1200" height="800">
  <figcaption>Debugging session paused at breakpoint</figcaption>
</figure>
```

## Capturing New Screenshots

Follow the guide at `examples/visualizer/capture_guide.md`:

1. Start the real system: `python examples/visualizer/demo_runner.py`
2. Connect your MCP client (Claude Desktop, etc.)
3. Execute real debugging commands
4. Capture using OS screenshot tools
5. Save with correct filenames to this directory
6. Run `python examples/visualizer/optimize_screenshots.py` to optimize sizes

## Authenticity Guarantee

**These screenshots are 100% authentic:**
- ✅ Captured from real debugging sessions
- ✅ Shows actual debugpy integration
- ✅ Demonstrates real bugs (like swap_vars.py)
- ✅ No mock data or staging
- ✅ Reproducible by anyone following the capture guide

## Technical Details

- **Format**: PNG (with WebP alternatives for modern browsers)
- **Optimization**: Images are optimized for web delivery without altering content
- **Color Space**: sRGB for web compatibility
- **Transparency**: Not used (solid backgrounds for better compression)

## File Organization

```
assets/screenshots/
├── README.md                    # This file
├── debugging-session.png        # Paused at breakpoint
├── debugging-session.webp       # WebP version
├── variable-inspection.png      # Shows the bug
├── variable-inspection.webp     # WebP version
├── mcp-integration.png         # Protocol messages
├── mcp-integration.webp        # WebP version
├── multi-session.png           # Multiple sessions
└── multi-session.webp          # WebP version
```

## License

These screenshots are part of the mcp-debugger project and are subject to the same license terms.
