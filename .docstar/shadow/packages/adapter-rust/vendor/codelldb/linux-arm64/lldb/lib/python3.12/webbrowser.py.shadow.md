# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/webbrowser.py
@source-hash: cc1eccbff96cf8ce
@generated: 2026-02-09T18:10:35Z

## Primary Purpose
Cross-platform web browser launcher module providing unified interface for opening URLs in system browsers across Windows, macOS, and Unix/Linux platforms.

## Core Public API
- `open(url, new=0, autoraise=True)` (L72-92): Main entry point for opening URLs with window control options
- `open_new(url)` (L94-99): Convenience function for new window 
- `open_new_tab(url)` (L101-106): Convenience function for new tab
- `get(using=None)` (L38-66): Returns browser instance, with optional browser specification
- `register(name, klass, instance=None, *, preferred=False)` (L23-36): Register browser controllers

## Browser Registry System
- Global `_browsers` dict (L19): Maps browser names to [class, instance] pairs
- Global `_tryorder` list (L20): Preference-ordered browser names for fallback attempts
- Thread-safe access via `_lock` RLock (L18)
- `register_standard_browsers()` (L467-545): Auto-discovers and registers platform browsers

## Browser Controller Hierarchy

### Base Classes
- `BaseBrowser` (L143-160): Abstract base with `open()`, `open_new()`, `open_new_tab()` methods
- `GenericBrowser` (L162-187): Launches browsers via subprocess, handles command-line parsing
- `BackgroundBrowser` (L190-206): Like GenericBrowser but starts new session for background execution

### Unix Browser Controllers
- `UnixBrowser` (L209-285): Base for Unix browsers with remote control capabilities
  - Supports remote actions via command-line flags (new window/tab)
  - Falls back to direct invocation if remote fails
  - Configurable via `remote_args`, `remote_action*` class attributes
- `Mozilla` (L288-296): Firefox family browsers
- `Chrome` (L308-317): Chrome/Chromium browsers (Chromium aliased at L317)
- `Opera` (L320-328): Opera browser
- `Epiphany` (L298-306): GNOME Epiphany browser
- `Elinks` (L330-342): Text-mode browser with stdout redirection disabled
- `Konqueror` (L344-395): KDE browser with multiple fallback commands
- `Edge` (L397-405): Microsoft Edge on Unix

### Platform-Specific Controllers
- `WindowsDefault` (L554-564): Uses `os.startfile()` for Windows default browser
- `MacOSX` (L572-619): Legacy macOS support via AppleScript (deprecated)
- `MacOSXOSAScript` (L621-657): Current macOS implementation using osascript

## Platform Detection & Registration

### Unix/Linux (L500-531)
- Detects X11/Wayland display environments
- Registers desktop integration tools: xdg-open, gio, gvfs-open
- Environment-based registration: KDE_FULL_SESSION, GNOME_DESKTOP_SESSION_ID
- Console browser fallbacks when TERM is set
- Queries `xdg-settings` for system default browser (L504-511)

### Windows (L483-499)
- Registers windows-default first, then common browser executables
- Handles both 32-bit and 64-bit Edge locations

### macOS (L471-477)
- Registers MacOSXOSAScript instances for default, chrome, firefox, safari

## Browser Discovery
- `_synthesize(browser, *, preferred=False)` (L109-138): Creates controllers for user-specified browser paths
- BROWSER environment variable processing (L534-544): User override via colon-separated paths
- Automatic executable detection via `shutil.which()`

## Security & Auditing
- `sys.audit("webbrowser.open", url)` calls in all open methods for security monitoring
- URL validation and escaping for platform-specific launchers

## Key Patterns
- Lazy initialization: browsers only registered on first access
- Fallback chains: remote → direct invocation → next browser in tryorder
- Template-based command construction using %s and %action placeholders
- Platform-specific subprocess configuration (close_fds, start_new_session)
- Thread-safe singleton pattern for browser registry