# packages/adapter-javascript/vendor/js-debug/vendor/acorn-loose.js
@source-hash: f31275c5381d529b
@generated: 2026-02-09T18:13:51Z

## packages/adapter-javascript/vendor/js-debug/vendor/acorn-loose.js

**Primary Purpose**: A lenient/loose JavaScript parser built on top of the Acorn parser that can handle syntactically invalid code by inserting dummy nodes and continuing parsing.

**Core Architecture**:
- **LooseParser Class (L1)**: Main parser class extending Acorn's functionality with error recovery
- **UMD Wrapper (L1)**: Universal module definition for browser/Node.js compatibility
- **Error Recovery**: Uses dummy identifier/string symbols (N = "\u2716") for invalid syntax

**Key Classes and Functions**:

**LooseParser Constructor (L1)**:
- Initializes tokenizer from base Acorn parser
- Sets up parsing state: `ahead` array, `context` stack, indentation tracking
- Configures location tracking and validates regexp patterns

**Node Creation Methods (L1)**:
- `startNode()`: Creates AST nodes with position info
- `finishNode(e,i)`: Completes nodes with type and end position
- `dummyNode(e)`: Creates placeholder nodes for error recovery
- `dummyIdent()`: Creates dummy identifier with error marker (N symbol)
- `dummyString()`: Creates dummy literal for error recovery

**Token Management (L1)**:
- `next()`: Advances to next token with line/indentation tracking
- `readToken()`: Core tokenization with comprehensive error handling for unterminated strings, regexes, templates, invalid escapes, and unexpected characters
- `resetTo(t)`: Resets parser state to specific position
- `lookAhead(t)`: Non-consuming token lookahead

**Statement Parsing (L1)**:
- `parseTopLevel()`: Entry point returning Program node
- `parseStatement()`: Handles all statement types (break, continue, debugger, do-while, for, function, if, return, switch, throw, try, var, while, with, class, import, export)
- `parseBlock()`: Block statements with indentation-aware closing

**Expression Parsing (L1)**:
- `parseExpression()`: Sequence expressions and comma operators
- `parseMaybeAssign()`: Assignment expressions and yield handling
- `parseExprOp()`: Binary/logical expressions with precedence
- `parseMaybeUnary()`: Unary expressions, await, spread
- `parseExprAtom()`: Atomic expressions (identifiers, literals, this, super, etc.)

**Specialized Parsers**:
- `parseClass()`: Class declarations/expressions with method parsing
- `parseFunction()`: Function declarations/expressions with async/generator support
- `parseImport()/parseExport()`: ES6 module syntax
- `parseTemplate()`: Template literals with expression interpolation
- `parseObj()`: Object literals with computed properties and methods

**Error Recovery Features**:
- Continues parsing after syntax errors by inserting dummy nodes
- Uses indentation-based heuristics for block/statement boundaries
- Handles incomplete constructs (unterminated strings, unclosed braces)
- Validates and recovers from regexp/template errors

**Dependencies**:
- **Acorn Parser**: Base tokenizer and AST node types from `./acorn`
- **Token Types**: Extensive use of `s.tokTypes` for token classification
- **Source Locations**: Optional position tracking with `s.SourceLocation`

**Key Architectural Patterns**:
- **Recursive Descent**: Standard parser architecture with lookahead
- **Error Recovery**: Lenient parsing continues despite syntax errors
- **Context Tracking**: Maintains parse context stack for indentation-sensitive constructs
- **Precedence Climbing**: Binary expression parsing with operator precedence
- **AST Construction**: Builds standard ESTree-compatible AST nodes

**Critical Invariants**:
- Always produces valid AST even from invalid input
- Maintains token position consistency across error recovery
- Preserves source location information when enabled
- Dummy nodes use special marker symbol (N) for identification