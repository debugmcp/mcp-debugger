# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/turtle.py
@source-hash: 5e0e21a736c0d20f
@generated: 2026-02-09T18:07:42Z

## Python Turtle Graphics Module (turtle.py)

**Primary Purpose**: Complete turtle graphics implementation for Python using Tkinter as the graphics backend. Provides Logo-style turtle graphics programming with enhanced features for educational programming and visualization.

### Core Architecture

**Base Classes:**
- `Vec2D` (L231-274): 2D vector class derived from tuple, supports vector operations (add, subtract, multiply, rotate). Used for position and orientation calculations.
- `TurtleScreenBase` (L454-841): Low-level graphics interface abstracting Tkinter operations. Handles canvas drawing, events, and image management.
- `TurtleScreen` (L947-1501): High-level screen management with coordinate systems, shapes, colors, and event handling.

**Turtle Components:**
- `TNavigator` (L1502-2018): Navigation functionality - movement, rotation, positioning. Handles different coordinate modes (standard, logo, world).
- `TPen` (L2020-2487): Drawing properties - pen state, colors, size, speed, visibility, shape transformation.
- `RawTurtle` (L2520-3719): Complete turtle implementation combining navigation and drawing. Manages undo buffer, stamping, filling, and screen interaction.

**User-Facing Classes:**
- `Turtle` (L3861-3880): Auto-creating canvas wrapper around RawTurtle for simple usage.
- `Screen` (L3725-3732): Singleton screen factory function.
- `_Screen` (L3733-3860): Singleton screen implementation with window management.

### Key Features

**Drawing System:**
- Line drawing with customizable pen properties (color, width, speed)
- Shape filling with begin_fill/end_fill (L3382-3422)
- Stamping for shape copying (L3106-3214)
- Polygon recording with begin_poly/end_poly (L3506-3544)

**Shape System:**
- Built-in shapes: arrow, turtle, circle, square, triangle, classic (L960-979)
- Custom shape registration supporting polygons, images, and compound shapes
- Shape transformation: scaling, rotation, shearing (L2836-3022)

**Event Handling:**
- Mouse events: click, drag, release (L3591-3656)
- Keyboard events through screen methods
- Timer events for animations

**Coordinate Systems:**
- Standard mode: (0,0) center, positive x right, positive y up
- Logo mode: (0,0) center, turtle starts pointing north
- World mode: user-defined coordinate system (L1060-1098)

**Animation Control:**
- Speed settings (0-10, plus named speeds: fastest, fast, normal, slow, slowest)
- Tracer for controlling update frequency (L2237-2264)
- Delay control for animation timing

### Configuration System

**Default Configuration** (L144-164): Screen dimensions, colors, speeds, language settings loaded from `_CFG` dictionary.

**Config File Support** (L166-229): Reads `turtle.cfg` files for customization with `config_dict()` and `readconfig()` functions.

### Global Function Interface

**Dynamic Function Creation** (L4026-4041): All turtle methods automatically exposed as global functions using `_make_global_funcs()`. Creates procedural interface where functions operate on default turtle/screen instances.

**Function Lists:**
- Screen functions (L115-121): bgcolor, setup, listen, etc.
- Turtle functions (L122-134): forward, back, left, right, etc.
- Utility functions (L135): write_docstringdict, done

### Internationalization

**Language Support** (L3917-3943): Docstring translation system with `read_docstrings()` and `write_docstringdict()` for creating language-specific documentation.

### Error Handling

**Custom Exceptions:**
- `Terminator` (L848-854): Stops turtle execution
- `TurtleGraphicsError` (L857-860): General turtle graphics errors

### Demo System (L4046-4207)

Two complete demo programs showcasing basic and advanced features including animations, filling, stamping, and interactive elements.