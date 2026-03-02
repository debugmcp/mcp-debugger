# Plan: Add Expression Evaluation to JDI Bridge

## Context

The JDI bridge (`JdiDapServer.java`) currently has very limited expression evaluation — it can only look up simple local variables, `this`, and single-level `obj.field`. Python and JavaScript adapters support full expression evaluation (arithmetic, method calls, etc.) because their debug adapters handle it natively. JDI provides no built-in expression evaluator, so we need to write one.

The jdb tool's expression evaluator (`com.sun.tools.example.debug.expr`) has split licensing: GPL2+CPE in OpenJDK, Oracle BSD License in Oracle's JDK 8 Demos distribution. It's also JavaCC-generated (~2000 lines). Rather than take on that complexity and licensing ambiguity, we'll write a hand-rolled recursive descent parser from scratch (~500 lines).

## Approach

Add an `ExprEvaluator` static inner class to `JdiDapServer.java` (~500 lines). Single file, zero dependencies, JDK 11+. Replace `handleEvaluate` and `evaluateCondition` to delegate to it.

## Grammar (Java operator precedence)

```
expression     → or_expr
or_expr        → and_expr ( "||" and_expr )*
and_expr       → equality ( "&&" equality )*
equality       → comparison ( ("==" | "!=") comparison )*
comparison     → addition ( ("<" | ">" | "<=" | ">=") addition )*
addition       → multiplication ( ("+" | "-") multiplication )*
multiplication → unary ( ("*" | "/" | "%") unary )*
unary          → ("!" | "-") unary | postfix
postfix        → primary ( "." IDENT ("(" arglist? ")")? | "[" expression "]" )*
primary        → INTEGER | LONG | FLOAT | DOUBLE | STRING | CHAR
               | TRUE | FALSE | NULL | THIS
               | IDENT ("(" arglist? ")")?
               | "(" expression ")"
arglist        → expression ("," expression)*
```

## Supported expressions (Priority 1)

- **Literals**: int, long, float, double, string, char, boolean, null
- **Variables**: locals, `this`, implicit `this` fields, static fields of enclosing class
- **Chained field access**: `a.b.c.d`, `arr.length`
- **Method invocation**: `obj.method(args)`, chained `a.method1().method2()`
- **Array indexing**: `arr[0]`, `matrix[0][1]`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%` (including string concatenation)
- **Comparisons**: `==`, `!=`, `<`, `>`, `<=`, `>=`
- **Boolean**: `&&`, `||`, `!`
- **Unary**: `-expr`, `!expr`
- **Grouping**: `(expr)`
- **Auto-unboxing**: `Integer` → `int`, etc.

## Implementation steps

### Step 1. Add `ExprEvaluator` inner class to `JdiDapServer.java`

Place before the `JsonParser` inner class. Structure:

**Token system** (~20 lines): `TokenType` enum + `Token` record with type, text, position.

**Tokenizer** `tokenize()` (~100 lines):
- Numbers: int, long (`L`), float (`f`), double, hex `0x`, binary `0b`
- Strings with escape sequences (`\\`, `\"`, `\n`, `\t`, etc.), chars
- Identifiers → check keywords (`true`, `false`, `null`, `this`)
- Two-char ops: `==`, `!=`, `<=`, `>=`, `&&`, `||`
- Single-char ops: `+`, `-`, `*`, `/`, `%`, `<`, `>`, `!`, `.`, `(`, `)`, `[`, `]`, `,`

**Token helpers** (~30 lines): `peek()`, `advance()`, `match()`, `check()`, `expect()`, `error()`

**Parser methods** (~100 lines): One per precedence level, returns JDI `Value` directly (no AST).

**JDI interaction helpers** (~200 lines):
- `resolveVariable(name)` — local → `this` field → enclosing static field
- `accessField(target, name)` — `ReferenceType.fieldByName()` + `array.length` special case
- `invokeMethod(target, name, args)` — `ObjectReference.invokeMethod()` with `INVOKE_SINGLE_THREADED`; overload resolution by arg count then type compatibility
- `invokeStaticMethod(className, name, args)` — for bare calls in static context
- `arrayAccess(target, index)` — bounds-checked `ArrayReference.getValue()`
- `performArithmetic(left, op, right)` — numeric ops in Java, `vm.mirrorOf()` result back; string concat via `+`
- `performComparison/Equality` — numeric compare; reference equality for `==` on objects
- `unbox(Value)` — invoke `intValue()` etc. on boxed types via JDI `invokeMethod`
- `valueToString(Value)` — invoke `toString()` for string concat
- Primitive helpers: `isNumeric`, `toLong`, `toDouble`, `mirrorOf` wrappers

### Step 2. Replace `handleEvaluate` (lines 834-921)

~20 lines: create `ExprEvaluator`, call `evaluate()`, format with existing `makeVariable()`.

### Step 3. Replace `evaluateCondition` (lines 1087-1108)

~10 lines: create `ExprEvaluator`, evaluate, check `isTruthy()`. Enables real conditional breakpoints like `x > 5 && name.equals("test")`.

### Step 4. Add test fixture `examples/java/ExprTest.java`

Richer program with instance fields, arrays, methods, boxed types — one breakpoint exercises all expression types.

### Step 5. Add E2E test `tests/e2e/mcp-server-smoke-java-evaluate.test.ts`

Tests via MCP `evaluate_expression`:
- Literals: `42`, `"hello"`, `true`, `null`
- Variables: `x`, `this`
- Fields: `this.instanceField`, `this.name.length()`
- Methods: `msg.length()`, `msg.toUpperCase()`, `add(1, 2)`
- Arrays: `numbers[0]`, `numbers.length`
- Arithmetic: `x + 5`, `x * 2 + 1`, `10 / 3`
- String concat: `"Hello, " + name`
- Comparisons: `x > 5`, `x == 10`
- Boolean: `flag && true`, `!flag`
- Grouping: `(x + 5) * 2`

### Step 6. Add conditional breakpoint test

In `mcp-server-smoke-java.test.ts`, add test with conditional breakpoint.

## Key design decisions

- **`INVOKE_SINGLE_THREADED`** on all JDI method invocations to prevent deadlocks
- **Evaluate during parse** (no AST) — simpler, sufficient for debugging
- **Overload resolution**: arg count first, then best-effort type matching; full Java resolution is ~50 pages of JLS
- **Reference equality** for `==` on objects (matches Java semantics)
- **Error messages** include position in expression string

## Files to modify

| File | Action |
|------|--------|
| `packages/adapter-java/java/JdiDapServer.java` | Add `ExprEvaluator` inner class, replace `handleEvaluate` + `evaluateCondition` |
| `examples/java/ExprTest.java` | **Create** — test fixture |
| `tests/e2e/mcp-server-smoke-java-evaluate.test.ts` | **Create** — expression evaluation E2E |
| `tests/e2e/mcp-server-smoke-java.test.ts` | Add conditional breakpoint test |

## Verification

1. `javac -source 11 -target 11 -d packages/adapter-java/java/out packages/adapter-java/java/JdiDapServer.java` — compiles clean
2. `npm run build` — succeeds
3. `npx vitest run tests/adapters/java/` — unit tests pass
4. `npx vitest run tests/e2e/mcp-server-smoke-java.test.ts tests/e2e/mcp-server-smoke-java-attach.test.ts tests/e2e/mcp-server-smoke-java-evaluate.test.ts` — all E2E pass
5. `npm run lint` — clean
6. Interactive: MCP `evaluate_expression` with `1 + 2` in Java session → `"3"`
