# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/webbrowser.py
@source-hash: cc1eccbff96cf8ce
@generated: 2026-02-09T18:10:26Z

## webbrowser.py - Cross-platform web browser launching interface

**Primary Purpose**: Provides a unified interface for opening URLs in web browsers across different operating systems (Windows, macOS, Linux/Unix). Handles browser detection, registration, and fallback mechanisms.

### Core Components

**Global State Management (L18-21)**:
- `_lock`: Threading RLock for browser registry protection
- `_browsers`: Dictionary mapping browser names to [class, instance] pairs
- `_tryorder`: List defining browser preference order
- `_os_preferred_browser`: System's default browser from xdg-settings

**Public API Functions**:
- `register(name, klass, instance, preferred)` (L23-36): Registers browser controllers with optional preference ordering
- `get(using)` (L38-66): Returns appropriate browser launcher instance, handles command-line parsing and fallback synthesis
- `open(url, new, autoraise)` (L72-92): Main entry point for opening URLs with window/tab control
- `open_new(url)` (L94-99): Opens URL in new browser window
- `open_new_tab(url)` (L101-106): Opens URL in new browser tab

**Browser Synthesis (L109-138)**:
- `_synthesize(browser, preferred)`: Creates controllers for custom browser paths by cloning existing registered browsers

### Browser Controller Hierarchy

**Base Classes**:
- `BaseBrowser` (L143-159): Abstract parent class defining interface contract
- `GenericBrowser` (L162-187): Handles command-line browsers without remote control
- `BackgroundBrowser` (L190-206): For browsers that should run detached
- `UnixBrowser` (L209-285): Advanced Unix browsers with remote control capabilities

**Platform-Specific Controllers**:
- Unix browsers: `Mozilla` (L288-296), `Epiphany` (L298-306), `Chrome`/`Chromium` (L308-317), `Opera` (L320-328), `Elinks` (L330-342), `Konqueror` (L344-395), `Edge` (L397-405)
- Windows: `WindowsDefault` (L554-564) using os.startfile()
- macOS: `MacOSX` (L572-619) deprecated, `MacOSXOSAScript` (L621-657) using AppleScript

### Platform Registration Logic

**Standard Browser Registration (L467-547)**:
- macOS (L471-477): Registers AppleScript-based browsers
- SerenityOS (L479-481): Basic Browser support
- Windows (L483-499): Windows default + common browser executables
- Unix/Linux (L500-530): X11/Wayland browsers + console browsers
- Environment variable override via `BROWSER` (L534-545)

**Unix X11 Browser Detection (L414-464)**:
- Prioritizes xdg-open, gio, gvfs-open for desktop integration
- Detects Mozilla family, Chrome family, KDE/GNOME browsers
- Handles desktop environment variables (GNOME_DESKTOP_SESSION_ID, KDE_FULL_SESSION)

### Key Architecture Decisions

**Thread Safety**: All browser registry operations protected by RLock (L18, L25, L41, L85)

**Lazy Initialization**: Browser registration deferred until first use via `register_standard_browsers()`

**Fallback Strategy**: Multiple fallback mechanisms:
1. Remote control → direct invocation (UnixBrowser L279-285)
2. Preferred browsers → registered browsers → synthesized browsers
3. Platform-specific → generic command execution

**Security**: URL auditing via `sys.audit("webbrowser.open", url)` before browser invocation

**Process Management**: Platform-aware subprocess handling with appropriate close_fds, start_new_session settings

### Command Line Interface

**Main Function (L660-689)**: Standalone script support with -n (new window), -t (new tab), -h (help) options

### Dependencies

**Standard Library**: os, shlex, shutil, sys, subprocess, threading, warnings, getopt
**Platform Detection**: sys.platform checks for 'darwin', 'win', 'serenityos'
**External Tools**: xdg-open, gio, gvfs-open, kfmclient, osascript