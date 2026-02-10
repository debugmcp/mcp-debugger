# tests/implementations/
@generated: 2026-02-10T21:26:28Z

## Overview

The `tests/implementations` directory provides a comprehensive testing infrastructure consisting of fake/mock implementations that enable deterministic unit testing of process management functionality without spawning real system processes.

## Core Purpose

This module serves as the primary testing backbone for process-related operations by providing controllable test doubles that simulate real process behavior. It enables developers to:

- Execute process-launching code deterministically in unit tests
- Control process lifecycle events (spawn, output, error, exit) programmatically  
- Verify process interactions without external system dependencies
- Test error scenarios and edge cases reliably and repeatably

## Architecture and Component Organization

The module implements a comprehensive fake system that mirrors the real process architecture through multiple coordinated layers:

**Process Layer**
- Core process mocks (`FakeProcess`, `FakeProxyProcess`) that emulate system process behavior with controllable I/O streams and lifecycle events

**Launcher Layer** 
- Specialized launcher fakes for different process types (basic, debug target, proxy) that capture launch parameters and return configured fake processes

**Factory Layer**
- Centralized factory pattern providing singleton access to all fake launcher instances

## Public API Surface

**Primary Entry Point:**
- `FakeProcessLauncherFactory` - Main factory providing access to all fake launcher implementations

**Core Testing Interfaces:**
- Standard launcher methods (`launch()`, `launchPythonDebugTarget()`, `launchProxy()`) that return controllable fake processes
- Test control methods (`prepare*()`, `simulate*()`, `reset()`) for configuring behavior and managing test state
- Verification methods (`getLastLaunched*()`) for inspecting launch history and parameters

## Key Testing Patterns and Features

**Deterministic Behavior:**
- Fixed, predictable process identifiers and port assignments
- Controllable async event timing for reliable test execution

**Complete Command Interception:**
- Full command history tracking for verification
- Automatic response handling for proxy initialization scenarios

**Comprehensive State Management:**
- Detailed launch history preservation (commands, arguments, options, environments)
- Centralized cleanup and reset functionality across all fake implementations

## Integration and Usage

This module provides complete fake implementations for all interfaces defined in the process management system, ensuring comprehensive test coverage while maintaining behavioral fidelity to real process operations. It serves as the foundation for unit testing any component that interacts with system processes, enabling fast, reliable, and isolated test execution.