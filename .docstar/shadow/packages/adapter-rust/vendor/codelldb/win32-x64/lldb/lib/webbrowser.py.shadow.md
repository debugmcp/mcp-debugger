# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/webbrowser.py
@source-hash: cc1eccbff96cf8ce
@generated: 2026-02-09T18:14:26Z

**Purpose**: Platform-agnostic web browser launcher that provides a unified interface to open URLs across Windows, macOS, and Unix-like systems. Handles browser discovery, registration, and invocation with support for different opening modes (same window, new window, new tab).

## Core Components

**Public API Functions (L23-106)**:
- `register(name, klass, instance=None, *, preferred=False)` (L23): Registers browser controllers with optional preference ordering
- `get(using=None)` (L38): Returns appropriate browser launcher instance for environment
- `open(url, new=0, autoraise=True)` (L72): Main URL opening function with window control
- `open_new(url)` (L94) / `open_new_tab(url)` (L101): Convenience wrappers for specific opening modes

**Global State (L18-21)**:
- `_browsers` dict: Registry of available browser controllers
- `_tryorder` list: Browser preference order for fallback attempts
- `_os_preferred_browser`: System default browser detection
- `_lock`: Thread synchronization for registration

**Browser Controller Classes**:

*Base Classes*:
- `BaseBrowser` (L143-160): Abstract parent defining interface contract
- `GenericBrowser` (L162-188): Command-line browser launcher with subprocess execution
- `BackgroundBrowser` (L190-207): Non-blocking variant using `start_new_session=True`

*Unix Browser Classes*:
- `UnixBrowser` (L209-286): Advanced controller with remote command support and fallback mechanisms
- `Mozilla` (L288-296), `Chrome` (L308-316), `Opera` (L320-328): Firefox/Chrome/Opera-specific launchers
- `Epiphany` (L298-306), `Elinks` (L330-342): GNOME/text browser controllers
- `Konqueror` (L344-395): KDE browser with multiple command fallbacks
- `Edge` (L397-405): Microsoft Edge on Unix

*Platform-Specific Classes*:
- `WindowsDefault` (L554-565): Uses `os.startfile()` for Windows default browser
- `MacOSX` (L572-620): Legacy AppleScript-based macOS launcher (deprecated)
- `MacOSXOSAScript` (L621-658): Modern macOS launcher using osascript

## Browser Discovery & Registration

**Platform Detection (L467-547)**:
- `register_standard_browsers()` (L467): Main registration orchestrator
- `register_X_browsers()` (L414): Unix GUI browser discovery via `shutil.which()`
- Environment-based detection: `DISPLAY`, `WAYLAND_DISPLAY`, `KDE_FULL_SESSION`, `GNOME_DESKTOP_SESSION_ID`
- `BROWSER` environment variable parsing for user overrides

**Browser Synthesis (L109-138)**:
- `_synthesize()` creates controllers for custom browser paths by cloning existing registered browsers

## Key Patterns

**Fallback Strategy**: Multiple attempts with graceful degradation (remote → direct invocation → next browser)
**Cross-Platform Abstraction**: Platform-specific implementations behind common interface
**Thread Safety**: Uses `threading.RLock()` for browser registration
**Security**: All URL opening goes through `sys.audit("webbrowser.open", url)` for monitoring

## Dependencies
- `subprocess`: Cross-platform process launching
- `shutil.which()`: Executable discovery
- `threading.RLock()`: Thread-safe registration
- `os.environ`, `sys.platform`: Platform/environment detection