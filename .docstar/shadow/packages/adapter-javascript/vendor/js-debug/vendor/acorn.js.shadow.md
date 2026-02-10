# packages/adapter-javascript/vendor/js-debug/vendor/acorn.js
@source-hash: 0fe5b322eea54501
@generated: 2026-02-09T18:13:43Z

**Primary Purpose**: Vendor copy of Acorn.js JavaScript parser library (version 8.11.3), providing comprehensive JavaScript AST parsing capabilities. This is a minified UMD (Universal Module Definition) build that supports both CommonJS and AMD module systems.

**Key Architecture**:
- **Parser Core** (y class, L1): Main parser class with tokenizer, AST builder, and scope tracking
- **Tokenizer** (x prototype methods, L1): Lexical analysis for JavaScript tokens including keywords, operators, literals
- **AST Node System** (ee class, L1): Node construction with position tracking and source location support
- **Context System** (P class, b object, L1): Parse context tracking for different syntactic constructs
- **Scope Management** (At class, D prototype, L1): Variable scope tracking and binding validation
- **RegExp Parser** (L class, c prototype, L1): Dedicated regular expression literal parser with Unicode support

**Key Features**:
- Full ES2015+ syntax support including async/await, classes, modules, destructuring
- Source location tracking with line/column information
- Configurable ECMAScript version targeting (ES5-ES2024)
- Strict mode detection and enforcement
- Private field validation for classes
- Unicode identifier and property support
- Template literal parsing with tagged templates

**Token System**:
- Comprehensive token types (a object, L1) covering all JavaScript constructs
- Keyword detection with contextual handling
- Operator precedence and associativity
- Special handling for template literals and regular expressions

**Parse Modes**:
- Script vs module parsing modes
- Expression-only parsing capability
- Streaming tokenizer interface
- Error recovery and position reporting

**Integration Points**:
- Options object (ae, L1) for parser configuration
- Plugin extension system via Parser.extend()
- Token and comment callback hooks
- Custom source file attribution

**Critical Invariants**:
- All AST nodes include start/end positions
- Scope stack maintains proper nesting
- Token stream maintains parse state consistency
- Unicode handling follows ECMAScript specification

This is a production-ready parser used extensively in JavaScript tooling ecosystems for code analysis, transformation, and bundling.