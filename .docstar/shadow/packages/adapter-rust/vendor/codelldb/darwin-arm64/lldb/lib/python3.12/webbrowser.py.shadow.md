# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/webbrowser.py
@source-hash: cc1eccbff96cf8ce
@generated: 2026-02-09T18:07:38Z

## Purpose
Python standard library module for launching and controlling web browsers across platforms. Provides a unified interface to open URLs in various browsers with support for new windows/tabs and browser detection/registration.

## Key Public API
- `open(url, new=0, autoraise=True)` (L72-92): Main function to open URLs. `new` controls window behavior (0=same, 1=new window, 2=new tab)
- `open_new(url)` (L94-99): Opens URL in new window
- `open_new_tab(url)` (L101-106): Opens URL in new tab
- `get(using=None)` (L38-66): Returns browser controller instance, auto-detects if `using` is None
- `register(name, klass, instance=None, *, preferred=False)` (L23-36): Registers browser controller

## Core Data Structures
- `_browsers` (L19): Dictionary mapping browser names to [class, instance] pairs
- `_tryorder` (L20): List defining browser preference order
- `_os_preferred_browser` (L21): OS-detected preferred browser from xdg-settings

## Browser Controller Hierarchy
- `BaseBrowser` (L143-160): Abstract base class with `open()`, `open_new()`, `open_new_tab()` methods
- `GenericBrowser` (L162-188): Simple command-line browser launcher
- `BackgroundBrowser` (L190-207): Launches browsers in background with `start_new_session=True`
- `UnixBrowser` (L209-286): Advanced Unix browser with remote control support via command-line args
- Platform-specific controllers:
  - `WindowsDefault` (L554-564): Uses `os.startfile()` on Windows
  - `MacOSXOSAScript` (L621-657): Uses AppleScript on macOS
  - Browser-specific: `Mozilla` (L288-296), `Chrome` (L308-317), `Opera` (L320-328), etc.

## Platform Detection & Registration
- `register_standard_browsers()` (L467-546): Main registration function, detects platform and available browsers
- `register_X_browsers()` (L414-465): Registers GUI browsers on Unix systems with X11/Wayland
- Windows detection (L483-499): Registers Edge, Firefox, Chrome with fallback paths
- macOS detection (L471-477): Registers default, Chrome, Firefox, Safari via AppleScript
- Environment variable support: `BROWSER` env var overrides defaults (L534-545)

## Browser Launch Mechanisms
- Command substitution: `%s` replaced with URL, `%action` with browser-specific action flags
- Remote control: Unix browsers attempt remote commands first, fall back to direct launch
- Process handling: Uses `subprocess.Popen` with platform-specific flags (`close_fds`, `start_new_session`)
- Security: `sys.audit("webbrowser.open", url)` calls for security monitoring

## Thread Safety
- Uses `threading.RLock()` (`_lock`, L18) to protect browser registration and initialization
- Double-checked locking pattern in `get()` and `open()` functions

## Error Handling
- `Error` exception class (L15-16) for browser-related failures
- Graceful fallbacks: remote → direct launch, preferred → available browsers
- Returns boolean success/failure from `open()` methods