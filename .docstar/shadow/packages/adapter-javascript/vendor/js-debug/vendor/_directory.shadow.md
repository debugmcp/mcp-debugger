# packages/adapter-javascript/vendor/js-debug/vendor/
@generated: 2026-02-09T18:16:07Z

## Vendor JavaScript Parser Module

**Overall Purpose**: This directory contains vendored copies of the Acorn JavaScript parser ecosystem, providing both strict and lenient parsing capabilities for JavaScript code. It serves as the foundational parsing layer for JavaScript debugging and code analysis tools within the js-debug adapter.

**Key Components and Integration**:

**Core Parser (acorn.js)**:
- Production-ready Acorn.js parser library (v8.11.3) in minified UMD format
- Provides strict, spec-compliant JavaScript AST parsing
- Handles full ES2015+ syntax including async/await, classes, modules, destructuring
- Offers configurable ECMAScript version targeting (ES5-ES2024)
- Maintains comprehensive token system and scope management

**Lenient Parser Extension (acorn-loose.js)**:
- Error-tolerant parser wrapper built on top of the core Acorn parser
- Extends LooseParser class from base Acorn functionality
- Provides graceful error recovery by inserting dummy nodes (marked with special symbol "\u2716")
- Continues parsing despite syntax errors, crucial for debugging malformed code
- Uses indentation-based heuristics for incomplete constructs

**Architectural Relationship**:
The two parsers form a complementary system:
- **acorn.js** serves as the foundational parser engine with strict validation
- **acorn-loose.js** wraps and extends this engine to handle real-world debugging scenarios where code may be incomplete or syntactically invalid
- Both produce ESTree-compatible AST nodes with consistent positioning information
- Shared token system and node construction patterns ensure compatibility

**Public API Surface**:
- **Strict Parsing**: Full JavaScript parsing with error reporting
- **Lenient Parsing**: Fault-tolerant parsing for debugging scenarios  
- **Tokenizer Interface**: Streaming token analysis
- **AST Construction**: ESTree-compatible node generation
- **Source Location Tracking**: Line/column position maintenance
- **Scope Analysis**: Variable binding and context tracking

**Internal Organization**:
- UMD wrapper enables both browser and Node.js compatibility
- Modular parser components (tokenizer, AST builder, scope tracker, context system)
- Plugin-extensible architecture via Parser.extend()
- Configurable parsing modes (script vs module, various ES versions)

**Key Patterns**:
- **Recursive Descent Parsing**: Both parsers use standard recursive descent with lookahead
- **Error Recovery Strategy**: Loose parser maintains parse state consistency across errors
- **Context-Sensitive Parsing**: Indentation and bracket-aware parsing for incomplete code
- **Position Preservation**: All nodes maintain source location for debugging integration

**Role in Larger System**:
This vendor directory provides the JavaScript parsing foundation for the debug adapter, enabling:
- Syntax analysis of debugged JavaScript code
- Handling of incomplete/malformed code during active development
- AST-based code inspection and manipulation
- Source mapping and position tracking for debugging operations