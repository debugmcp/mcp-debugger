# mcp-debugger Roadmap

This document outlines planned features and improvements for mcp-debugger.

## 🚧 Unimplemented Features

Based on testing conducted on 2025-06-11, the following features are defined in the API but not yet implemented:

### High Priority

#### 1. Expression Evaluation (`evaluate_expression`)
- **Status**: Returns "Evaluate expression not yet implemented with proxy"
- **Purpose**: Allow evaluation of arbitrary expressions in the current debugging context
- **Use cases**:
  - Inspect complex object properties
  - Test conditions without modifying code
  - Calculate values on the fly

#### 2. Conditional Breakpoints
- **Status**: Parameter exists but functionality not verified
- **Purpose**: Set breakpoints that only trigger when conditions are met
- **Use cases**:
  - Debug loops with specific iterations
  - Catch edge cases
  - Reduce debugging noise

### Medium Priority

#### 3. Pause Execution (`pause_execution`)
- **Status**: Returns "Pause execution not yet implemented with proxy"
- **Purpose**: Pause a running program at any point
- **Use cases**:
  - Interrupt long-running processes
  - Debug timing-sensitive code
  - Handle unexpected behavior

#### 4. Source Context (`get_source_context`)
- **Status**: Returns "Get source context not yet fully implemented with proxy"
- **Purpose**: Retrieve source code around a specific line
- **Use cases**:
  - Provide context without full file access
  - Optimize large file handling
  - Enable smart code navigation

### Low Priority

#### 5. Remote Debugging
- **Status**: Parameters exist (host, port) but not utilized
- **Purpose**: Debug processes on remote machines
- **Use cases**:
  - Production debugging
  - Containerized applications
  - Distributed systems

## ✅ Recently Implemented

These features are fully functional as of v0.9.0:

- ✅ Basic debugging operations (create session, set breakpoints, start debugging)
- ✅ Stepping operations (step over, step into, step out)
- ✅ Variable inspection with proper scope handling
- ✅ Stack trace navigation
- ✅ Session management

## 🎯 Future Enhancements

### Q1 2025
- [ ] Complete expression evaluation support
- [ ] Implement conditional breakpoints
- [ ] Add pause execution capability

### Q2 2025
- [ ] Multi-language support (JavaScript, TypeScript)
- [ ] Enhanced error messages with suggestions
- [ ] Performance optimizations for large variable sets

### Q3 2025
- [ ] Remote debugging support
- [ ] Watch expressions
- [ ] Debug console integration

### Beyond 2025
- [ ] Support for additional languages (Java, C++, Go)
- [ ] Advanced breakpoint types (data breakpoints, function breakpoints)
- [ ] Time-travel debugging capabilities
- [ ] Integration with popular IDEs

## 🤝 Contributing

We welcome contributions! If you're interested in implementing any of these features:

1. Check the [GitHub Issues](https://github.com/debugmcp/mcp-debugger/issues) for existing discussions
2. Open a new issue to discuss your implementation approach
3. Follow the [Contributing Guidelines](./CONTRIBUTING.md)

## 📊 Implementation Notes

### Known Limitations

1. **Breakpoint Verification**: Breakpoints show `"verified": false` until debugging starts
2. **Session Persistence**: Sessions may terminate unexpectedly during certain operations
3. **Path Handling**: Uses absolute paths which may cause issues across different environments

### Technical Debt

- Proxy architecture needs refactoring for pause/evaluate features
- Better error handling for edge cases
- Improved session lifecycle management

## 📅 Version History

- **v0.9.0** - Initial release with core debugging features
- **v0.8.0** - Beta release with basic Python support
- **v0.7.0** - Alpha release for testing

---

*Last updated: 2025-06-11*
