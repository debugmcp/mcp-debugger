# packages\adapter-python/
@children-hash: 6592e7185a2c79f9
@generated: 2026-02-15T09:01:58Z

## Overall Purpose & Responsibility

The `adapter-python` package provides a complete Python debugging adapter implementation for the mcp-debugger framework. It enables seamless Python debugging capabilities through debugpy integration, offering comprehensive environment detection, configuration management, and full DAP (Debug Adapter Protocol) compliance. This package serves as the bridge between the mcp-debugger framework and Python development environments, ensuring reliable debugging sessions across diverse Python installations and platforms.

## Key Components & Architecture

### **Core Implementation (`src/`)**
- **PythonDebugAdapter**: Main adapter class implementing the `IDebugAdapter` interface, managing complete debugging session lifecycle with state tracking, connection management, and DAP protocol operations
- **PythonAdapterFactory**: Factory implementation following dependency injection patterns for adapter creation and environment validation
- **Utils Module**: Cross-platform Python executable discovery system with sophisticated environment detection, virtual environment support, and debugpy-aware selection
- **PythonLaunchConfig**: Extended configuration supporting Python-specific debugging options including framework support (Django/Flask), module execution, and subprocess debugging

### **Environment Discovery System**
Multi-layered discovery pipeline that evaluates:
- Preferred paths and environment variables (`PYTHON_EXECUTABLE`, `pythonLocation`)  
- Auto-detection with platform-specific strategies
- Virtual environment detection and debugpy availability assessment
- Windows Store Python alias filtering and py launcher support
- TTL-based caching (60-second) for performance optimization

### **Testing Infrastructure (`tests/`)**
Comprehensive test suite ensuring reliability:
- **Smoke Tests**: Basic package integrity and export validation
- **Unit Tests**: Detailed factory, adapter lifecycle, and discovery system validation  
- **Cross-Platform Testing**: Windows, Linux, macOS-specific behavior verification
- **Mock Infrastructure**: Sophisticated subprocess and environment simulation

## Public API Surface

### **Primary Entry Points (index.ts)**
- `PythonDebugAdapter` and `PythonAdapterFactory` classes for adapter management
- `findPythonExecutable` and `getPythonVersion` utility functions for environment discovery
- `CommandFinder` type and `CommandNotFoundError` exception for extensibility

### **Factory Interface**
- `createAdapter()`: Instantiates Python debug adapter instances
- `getMetadata()`: Returns adapter metadata with language info, file extensions (.py, .pyw), and SVG icon
- `validate()`: Comprehensive environment validation with detailed error/warning reporting

### **Adapter Interface**
Full `IDebugAdapter` implementation providing:
- Complete DAP protocol operations with Python-specific validation
- Debugging session lifecycle management
- Capability reporting (breakpoints, exception handling, variable inspection)
- State management with event emission

## Internal Organization & Data Flow

### **Initialization Pipeline**
1. **Factory Validation**: Checks Python environment (≥3.7) and debugpy availability
2. **Environment Discovery**: Multi-priority search with platform-specific strategies
3. **Adapter Creation**: Initializes with resolved Python executable and cached metadata
4. **Session Management**: Handles debugging lifecycle with state tracking and cleanup

### **Runtime Architecture**
- **Command Resolution**: Platform-appropriate debugpy command construction
- **Error Translation**: Converts low-level errors to user-friendly messages  
- **Caching Strategy**: Performance optimization for repeated environment queries
- **Event Management**: Comprehensive lifecycle event emission and handling

### **Cross-Platform Support**
- Windows Store Python alias detection and filtering
- Platform-specific executable search paths and naming conventions
- Environment variable precedence handling
- Graceful degradation with multiple fallback strategies

## Important Patterns & Conventions

### **Design Patterns**
- **Factory Pattern**: Clean separation of creation and validation logic
- **Strategy Pattern**: Pluggable command resolution via CommandFinder interface
- **Template Method**: IDebugAdapter implementation with Python-specific behavior
- **Observer Pattern**: Event-driven lifecycle management

### **Critical Requirements**
- Python 3.7+ runtime requirement with version validation
- Debugpy module dependency with availability checking
- Thread-safe caching for concurrent access scenarios
- Comprehensive error handling with graceful degradation

### **Development Philosophy**
- Development-friendly defaults with extensive fallback mechanisms
- Verbose logging support via environment variables
- Comprehensive testing with cross-platform validation
- Robust error reporting for troubleshooting Python environment issues

The adapter-python package provides a production-ready Python debugging solution that seamlessly integrates with the mcp-debugger framework, offering reliable environment detection, comprehensive configuration support, and full DAP compliance while maintaining excellent developer experience across all supported platforms.