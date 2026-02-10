# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/turtle.py
@source-hash: 5e0e21a736c0d20f
@generated: 2026-02-09T18:10:21Z

## Python Turtle Graphics Module

The `turtle.py` module is a comprehensive Tkinter-based turtle graphics implementation for Python, providing an educational programming environment for creating drawings and animations using turtle metaphors.

### Core Architecture

The module follows a layered architecture with clear separation of concerns:

**Configuration System (L144-228)**: Global configuration dictionary `_CFG` with default settings for screen dimensions, colors, and turtle properties. Configuration loading from `turtle.cfg` files via `config_dict()` (L166-193) and `readconfig()` (L195-224).

**Vector Mathematics**: `Vec2D` class (L231-274) - immutable 2D vector implementation derived from tuple, supporting vector arithmetic, rotation, and geometric operations essential for turtle movement calculations.

**Graphics Backend (L275-841)**: Tkinter interface layer providing:
- `ScrolledCanvas` (L325-424) - enhanced canvas with scrolling capabilities
- `_Root` (L427-450) - root window management  
- `TurtleScreenBase` (L454-841) - low-level graphics primitives and event handling

### Primary Classes

**TurtleScreen** (L947-1501): High-level screen management providing:
- Shape registry and management (L960-979, L1099-1132)
- Color system with mode support (L1134-1192)
- Event binding for mouse/keyboard (L1341-1451) 
- Animation control via `tracer()` and `delay()` (L1237-1288)
- Coordinate system transformations including `setworldcoordinates()` (L1060-1097)

**Navigation Layer**: `TNavigator` (L1502-2018) implements turtle movement:
- Position and orientation tracking (L1529-1530)
- Movement methods: `forward()`, `back()`, `left()`, `right()` (L1615-1698)
- Coordinate methods: `goto()`, `setx()`, `sety()`, `home()` (L1742-1825)
- Geometric calculations: `distance()`, `towards()`, `heading()` (L1827-1907)
- Circle drawing with polygon approximation (L1937-1999)

**Drawing Layer**: `TPen` (L2020-2487) manages drawing state:
- Pen control: `penup()`, `pendown()`, `pensize()` (L2094-2135)
- Color management: `pencolor()`, `fillcolor()`, `color()` (L2175-2292)
- Turtle visibility: `showturtle()`, `hideturtle()` (L2303-2342)
- Complex pen state management via `pen()` method (L2344-2467)

**Turtle Implementation**: `RawTurtle` (L2520-3719) combines navigation and drawing:
- Undo system with `Tbuffer` ring buffer (L909-944)
- Shape rendering and transformation (L3024-3103)
- Stamp functionality (L3106-3214)
- Fill operations with polygon tracking (L3368-3422)
- Event handling for mouse interactions (L3591-3656)

### Key Features

**Shape System**: Comprehensive shape support including polygons, images, and compound shapes. Built-in shapes defined at L960-979. Custom shape registration via `register_shape()` (L1099-1132).

**Animation Control**: Multi-speed animation with tracer system. Speed 0 provides instant updates, speeds 1-10 provide progressive animation rates.

**Undo System**: Full undo/redo capability using circular buffer. Actions are recorded as tuples and can be reversed.

**Event System**: Mouse and keyboard event binding with coordinate translation between screen and turtle coordinate systems.

**Function Generation**: Dynamic function generation (L4006-4041) creates module-level functions from class methods, enabling both OOP and procedural programming styles.

### Module Organization

The module exports comprehensive function lists:
- `_tg_classes` (L113-114): Core classes
- `_tg_screen_functions` (L115-121): Screen-related functions  
- `_tg_turtle_functions` (L122-134): Turtle movement and drawing functions
- `_tg_utilities` (L135): Utility functions

**Singleton Pattern**: `Screen()` function (L3725-3731) implements singleton pattern for default screen instance.

**Demo System**: Built-in demonstrations (L4047-4207) showcase module capabilities including basic drawing, animation, and interactive features.

The module serves as both an educational tool for programming concepts and a capable graphics library for creating visual programs and animations.