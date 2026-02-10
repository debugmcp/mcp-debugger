# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/turtle.py
@source-hash: 5e0e21a736c0d20f
@generated: 2026-02-09T18:08:27Z

## Python Turtle Graphics Module

A comprehensive Tkinter-based turtle graphics implementation providing Logo-style programming with enhanced features beyond the standard library version.

### Core Architecture

**Configuration System (L144-228)**
- `_CFG` global dict containing default settings for screen, turtle, and behavior
- `config_dict()` (L166-193) and `readconfig()` (L195-224) parse turtle.cfg files
- Supports localized configurations and language-specific docstrings

**Vector Mathematics (L231-274)**
- `Vec2D` class extends tuple for 2D vector operations
- Supports addition, multiplication (scalar/dot product), rotation, and magnitude
- Used throughout for position and orientation calculations

### Graphics Backend (Tkinter Interface)

**Canvas Management (L325-424)**
- `ScrolledCanvas` (L325-424) provides scrollable drawing surface with automatic scrollbar management
- `_Root` (L427-450) wraps Tkinter root window functionality
- `__forwardmethods()` (L304-322) dynamically delegates Canvas methods

**Low-level Graphics (L454-841)**
- `TurtleScreenBase` (L454-841) abstracts graphics operations (lines, polygons, images, events)
- Handles coordinate scaling, mouse/keyboard events, and drawing primitives
- Platform-specific window management (macOS topmost handling L988-994)

### Screen Management

**TurtleScreen (L947-1501)**
- Main screen controller managing multiple turtles, shapes, and coordinate systems
- Shape registry with built-in shapes: arrow, turtle, circle, square, triangle, classic (L960-979)
- Three coordinate modes: standard, logo, world with `setworldcoordinates()` (L1060-1097)
- Color handling supporting both 1.0 and 255 color modes
- Event system for mouse clicks, key presses, and timers

**Singleton Screen (L3733-3859)**
- `_Screen` class provides singleton pattern for default screen
- `Screen()` factory function (L3725-3731) returns singleton instance
- Window setup, title management, and graceful shutdown

### Turtle Implementation

**Navigation (L1502-2018)**
- `TNavigator` handles movement and orientation
- Supports degrees/radians, multiple coordinate systems
- Core methods: `forward()`, `back()`, `right()`, `left()`, `goto()`, `circle()`
- Distance and heading calculations with `towards()` and `distance()`

**Drawing State (L2020-2487)**
- `TPen` manages drawing properties (color, size, visibility)
- Pen up/down state, speed control (0-10 or named speeds)
- Color handling with RGB tuples or color names
- Shape transformation (stretch, shear, tilt) for advanced graphics

**Turtle Objects (L2520-3720)**
- `RawTurtle` combines navigation and drawing with screen interaction
- Undo system via `Tbuffer` ring buffer (L909-944)
- Shape rendering supporting polygon, image, and compound shapes
- Stamp functionality for shape copying
- Fill operations with `begin_fill()`/`end_fill()`
- Event handling for mouse clicks and drags on individual turtles

### Shape System

**Shape Types (L862-907)**
- `Shape` class supports polygon, image, and compound shapes
- Polygon shapes defined by coordinate tuples
- Image shapes from GIF files
- Compound shapes combine multiple colored polygons

**Rendering Pipeline (L3066-3103)**
- `_drawturtle()` handles shape transformation and display
- Resize modes: auto, user, noresize affecting appearance
- Matrix transformations for scaling, rotation, and shearing

### Advanced Features

**Undo System (L3658-3717)**
- Comprehensive undo for movements, rotations, stamps, and property changes
- Configurable buffer size
- Sequence grouping for complex operations

**Event System**
- Mouse events on individual turtles and screen
- Keyboard event handling with focus management
- Timer events for animation

**Function Generation (L4006-4041)**
- Dynamic creation of module-level functions from class methods
- Maintains singleton turtle instance for procedural interface
- Automatic docstring adaptation for standalone functions

### Usage Patterns

Supports both object-oriented (`turtle = Turtle()`) and procedural (`import turtle; turtle.forward(100)`) programming styles. The module automatically creates screen and turtle instances as needed, making it suitable for educational programming while providing advanced features for complex graphics applications.