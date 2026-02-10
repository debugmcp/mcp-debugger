# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/turtle.py
@source-hash: 5e0e21a736c0d20f
@generated: 2026-02-09T18:14:35Z

## Primary Purpose
Python turtle graphics module providing Logo-style turtle drawing capabilities through Tkinter. Implements an object-oriented turtle graphics system with enhanced features beyond the standard Python turtle module.

## Key Classes

### Vec2D (L231-274)
2D vector class derived from tuple. Provides vector arithmetic operations (addition, subtraction, multiplication, rotation). Used for turtle position and orientation calculations.

### ScrolledCanvas (L325-424)
Tkinter-based scrollable canvas widget. Manages canvas scrollbars and resizing. Used as the default drawing surface for turtle graphics.

### TurtleScreenBase (L454-841)
Low-level graphics interface abstracting Tkinter operations. Provides primitive drawing methods like `_createpoly()`, `_drawline()`, `_onclick()`. Handles coordinate transformations and event binding.

### TurtleScreen (L947-1501)
High-level screen management class. Manages turtle shapes, colors, coordinate systems, and screen properties. Key methods include `bgcolor()`, `setup()`, `register_shape()`, `setworldcoordinates()`.

### TNavigator (L1502-2018)
Navigation component for turtle movement. Implements movement commands (`forward()`, `back()`, `left()`, `right()`) and position tracking. Handles coordinate transformations between different modes (standard/logo/world).

### TPen (L2020-2487)
Drawing properties component. Manages pen state (up/down), colors, line width, fill colors, and turtle visibility. Provides pen configuration through `pen()` method.

### RawTurtle (L2520-3720)
Core turtle implementation combining TNavigator and TPen. Handles drawing operations, shape management, stamping, undo buffer, and event handling. Main turtle functionality without automatic screen creation.

### Turtle (L3861-3880)
User-facing turtle class that auto-creates screen. Inherits from RawTurtle with simplified initialization.

### Screen (L3725-3860)
Singleton screen class managing the main turtle graphics window. Handles window setup, title, and cleanup.

## Key Functions

### Module-level Functions (L4026-4041)
Auto-generated functions that wrap turtle methods for procedural programming style. Created dynamically using `_make_global_funcs()`.

### Configuration System (L166-228)
`config_dict()` and `readconfig()` functions parse turtle.cfg files for customizing default behaviors and appearance.

### Utility Functions
- `write_docstringdict()` (L3883-3916): Creates docstring dictionary for internationalization
- `getmethparlist()` (L3946-3981): Extracts method parameter lists for function generation

## Important Dependencies
- `tkinter`: GUI framework for graphics and events
- `math`: Mathematical calculations for turtle movement
- `time`: Animation timing
- `inspect`: Method introspection for function generation

## Architectural Patterns

### Component-based Design
Turtle functionality split into navigation (TNavigator), drawing (TPen), and graphics (TurtleScreenBase) components composed into RawTurtle.

### Mode System
Supports three coordinate modes: "standard" (0° east), "logo" (0° north), "world" (user-defined coordinates).

### Undo System
Ring buffer (Tbuffer class, L909-944) stores reversible actions for undo functionality.

### Shape System
Polymorphic shape handling supporting polygons, images, and compound shapes through Shape class (L862-907).

### Global Function Generation
Dynamically creates module-level functions that delegate to turtle instances for procedural programming interface.

## Configuration
Default settings in `_CFG` dictionary (L144-164) control screen size, colors, turtle appearance, and behavior. Customizable via turtle.cfg files.