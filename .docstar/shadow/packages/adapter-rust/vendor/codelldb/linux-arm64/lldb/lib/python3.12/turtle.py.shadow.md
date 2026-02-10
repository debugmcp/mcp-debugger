# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/turtle.py
@source-hash: 5e0e21a736c0d20f
@generated: 2026-02-09T18:09:29Z

## Python Turtle Graphics Module

**Primary Purpose**: Complete turtle graphics implementation using Tkinter as the underlying graphics toolkit. Provides an educational programming environment for creating drawings and animations through turtle movement commands.

### Core Architecture

**Vec2D Class (L231-274)**: 2D vector implementation derived from tuple. Supports vector arithmetic operations (+, -, *, scalar multiplication), rotation, and absolute value calculations. Used throughout for position and orientation calculations.

**TurtleScreenBase Class (L454-841)**: Low-level graphics interface that abstracts Tkinter operations. Provides methods for creating/drawing polygons, lines, images, and handling mouse/keyboard events. Designed to be replaceable with other graphics toolkits.

**ScrolledCanvas Class (L325-424)**: Enhanced Tkinter Canvas with scrollbars. Manages canvas sizing, scrolling, and forwards Canvas methods using dynamic method forwarding (L304-323).

**TurtleScreen Class (L947-1501)**: High-level screen management extending TurtleScreenBase. Manages turtle shapes, colors, coordinate systems, event handling, and screen updates. Contains predefined shapes (arrow, turtle, circle, square, triangle, classic) and background management.

### Turtle Implementation Hierarchy

**TNavigator Class (L1502-2018)**: Handles turtle movement and positioning. Implements forward/backward movement, rotation, coordinate transformations, and different coordinate modes (standard, logo, world). Contains angle/distance calculations and circle drawing algorithms.

**TPen Class (L2020-2487)**: Manages drawing properties including pen state (up/down), colors, line width, speed, and turtle appearance (shape, size, tilt). Provides pen state management and visual property controls.

**RawTurtle Class (L2520-3720)**: Core turtle implementation combining TPen and TNavigator. Handles drawing operations, stamp functionality, undo buffer management, shape rendering, and event bindings. Manages the turtle's graphical representation and drawing state.

**Turtle Class (L3861-3880)**: Simplified turtle that auto-creates screen. Extends RawTurtle with automatic screen management for ease of use.

### Key Features

**Undo System**: Implemented through Tbuffer class (L909-944) providing circular buffer for turtle actions. Supports complex undo operations for movements, rotations, stamps, and drawing operations.

**Shape Management**: Flexible shape system supporting polygon, image, and compound shapes. Shapes can be transformed (scaled, rotated, sheared) and registered dynamically.

**Event System**: Comprehensive event handling for mouse clicks, key presses, and timers. Supports both screen-level and turtle-specific event bindings.

**Configuration System**: Config file support (L166-228) allowing customization of default values, language localization, and appearance settings.

**Function Interface**: Dynamic function generation (L4026-4041) that converts all turtle methods into standalone functions, enabling both OOP and procedural programming styles.

### Global State Management

**Screen Singleton**: _Screen class (L3733-3860) implements singleton pattern for screen management. Provides window setup, title management, and cleanup operations.

**Global Functions**: All turtle methods are automatically converted to global functions through metaprogramming, allowing direct function calls like `forward(100)` instead of requiring object creation.

### Dependencies

- **tkinter**: Primary graphics backend
- **math**: Mathematical calculations for movement and rotation  
- **time**: Animation timing
- **inspect**: Dynamic function signature analysis
- **copy.deepcopy**: Turtle cloning functionality

### Notable Design Patterns

- **Template Method**: TurtleScreenBase provides interface that can be implemented for different graphics toolkits
- **Singleton**: Screen management  
- **Command Pattern**: Undo system storing reversible operations
- **Observer**: Event handling system
- **Strategy**: Different coordinate modes and drawing strategies