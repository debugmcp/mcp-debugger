# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/webbrowser.py
@source-hash: cc1eccbff96cf8ce
@generated: 2026-02-09T18:08:29Z

## Purpose
Python's standard library module for launching and controlling web browsers across different platforms. Provides a unified interface to open URLs in system browsers, handling platform-specific browser detection and invocation methods.

## Core Architecture

### Global State (L18-21)
- `_lock`: Threading RLock for browser registration safety
- `_browsers`: Dictionary mapping browser names to [class, instance] pairs
- `_tryorder`: List defining browser preference order
- `_os_preferred_browser`: System's preferred browser (from xdg-settings)

### Public Interface
- `open(url, new=0, autoraise=True)` (L72-92): Main entry point for opening URLs
- `open_new(url)` (L94-99): Opens URL in new window (new=1)
- `open_new_tab(url)` (L101-106): Opens URL in new tab (new=2) 
- `get(using=None)` (L38-66): Returns appropriate browser controller instance
- `register(name, klass, instance=None, *, preferred=False)` (L23-36): Registers browser controllers

### Browser Controller Hierarchy

**BaseBrowser (L143-159)**: Abstract base class
- `open(url, new=0, autoraise=True)`: Must be implemented by subclasses
- `args = ['%s']`: Default URL substitution pattern

**GenericBrowser (L162-187)**: Simple command execution
- Handles browsers via subprocess with URL substitution
- Platform-aware process creation (Windows vs Unix)

**BackgroundBrowser (L190-206)**: Non-blocking execution
- Inherits GenericBrowser but uses `start_new_session=True` on Unix
- For browsers that should run detached

**UnixBrowser (L209-285)**: Advanced Unix browser control
- `_invoke()` (L226-259): Core invocation with remote/direct fallback
- Remote action mapping for different `new` values
- Timeout handling for remote calls (5 second max)

**Platform-Specific Controllers**:
- `Mozilla` (L288-295): Firefox family with remote control
- `Chrome/Chromium` (L308-317): Google Chrome variants
- `Opera` (L320-327): Opera browser
- `Epiphany` (L298-305): GNOME web browser
- `Konqueror` (L344-394): KDE browser with multiple fallback commands
- `Edge` (L397-404): Microsoft Edge
- `WindowsDefault` (L554-564): Uses `os.startfile()` on Windows
- `MacOSXOSAScript` (L621-657): AppleScript-based macOS browser control

### Browser Registration Logic

**`register_standard_browsers()` (L467-546)**: Platform detection and registration
- macOS: Uses AppleScript controllers
- Windows: Registers WindowsDefault + common browser executables
- Unix/Linux: 
  - X11 browsers via `register_X_browsers()` (L414-464)
  - Console browsers (links, lynx, w3m) when TERM is set
  - Respects BROWSER environment variable for user overrides

**`_synthesize()` (L109-138)**: Dynamic controller creation
- Attempts to create controllers for user-specified browser paths
- Clones existing controllers when executable basename matches registered browser

### Security Features
- `sys.audit("webbrowser.open", url)` calls before opening URLs
- Input validation (URL escaping for AppleScript)
- Process isolation via `close_fds=True` and `start_new_session=True`

### Command-Line Interface
`main()` (L660-689): Standalone script functionality supporting -n (new window), -t (new tab) options

## Key Patterns
- Lazy initialization: Browser registration deferred until first use
- Fallback chains: Remote → direct invocation, multiple browser attempts
- Platform abstraction: Unified interface hiding OS-specific details
- Environment awareness: DISPLAY, WAYLAND_DISPLAY, BROWSER, KDE_FULL_SESSION detection