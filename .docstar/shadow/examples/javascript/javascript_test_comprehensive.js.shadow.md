# examples/javascript/javascript_test_comprehensive.js
@source-hash: 3097d163e8b22c79
@generated: 2026-02-09T18:14:55Z

## Purpose
Test script designed for MCP (Model Context Protocol) debugger validation, demonstrating various JavaScript language features and debugging scenarios through a comprehensive suite of functions and execution patterns.

## Core Functions

**fibonacci(n)** (L6-12): Recursive implementation calculating Fibonacci numbers. Uses classic base case (n <= 1) and recursive calls for larger values. Inefficient O(2^n) complexity but useful for testing recursive debugging scenarios.

**calculateSum(numbers)** (L14-21): Iterates through array using for-of loop, accumulating sum in local variable. Demonstrates basic array processing and variable state changes during iteration.

**factorial(n)** (L23-33): Iterative factorial calculation using traditional for loop. Shows variable mutation patterns and conditional logic with base case handling.

**main()** (L35-78): Orchestrates seven distinct test scenarios covering:
- Variable assignment and arithmetic (L39-42)
- Array operations with function calls (L45-47) 
- Recursive function invocation (L50-51)
- Iterative calculations (L54-55)
- Object creation and property access (L58-63)
- Conditional branching logic (L66-70)
- Arrow function definition and execution (L73-75)

## Execution Flow
Script auto-executes via `main()` call (L81), providing immediate test results through console output. Each test section demonstrates different debugging challenges: variable inspection, call stack depth, loop iteration, object properties, and control flow.

## Architectural Patterns
- Functional decomposition with single-responsibility functions
- Mixed paradigms: recursive vs iterative implementations
- Console-driven output for debugging visibility
- Self-contained test scenarios for isolated debugging sessions

## Key Dependencies
- Node.js runtime (shebang L1)
- Native JavaScript features only (no external modules)

## Critical Characteristics
All functions are pure (no side effects except console output), making state inspection predictable. The script provides graduated complexity from simple arithmetic to recursive calls, ideal for testing debugger capabilities across different execution contexts.