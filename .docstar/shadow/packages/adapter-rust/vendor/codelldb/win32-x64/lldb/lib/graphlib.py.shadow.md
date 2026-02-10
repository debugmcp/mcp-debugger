# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/graphlib.py
@source-hash: 7bd338c5a475d110
@generated: 2026-02-09T18:12:55Z

## Primary Purpose
Implements topological sorting for directed acyclic graphs (DAGs) with cycle detection. Provides both streaming (incremental) and batch sorting capabilities for dependency resolution scenarios.

## Key Classes and Functions

### _NodeInfo (L9-24)
Internal data structure representing graph nodes with tracking state:
- `node`: The actual node object being tracked
- `npredecessors`: Counter tracking remaining dependencies (0 = ready, _NODE_OUT = returned, _NODE_DONE = processed)
- `successors`: List of dependent nodes (allows duplicates)

### CycleError (L26-38)
ValueError subclass raised when cycles are detected. The cycle path is available as the second element in the exception's args tuple, formatted as a list where first and last nodes are identical to show cyclical nature.

### TopologicalSorter (L41-250)
Main class providing topological sorting functionality:

**Core State Management:**
- `_node2info` (L45): Maps nodes to _NodeInfo objects
- `_ready_nodes` (L46): List of nodes with no remaining dependencies
- `_npassedout` (L47): Counter of nodes returned by get_ready()
- `_nfinished` (L48): Counter of nodes marked done()

**Key Methods:**
- `add(node, *predecessors)` (L59-84): Adds nodes and dependencies to graph. Can be called multiple times for same node (dependencies are unioned). Raises ValueError if called after prepare().
- `prepare()` (L86-106): Finalizes graph and detects cycles. Must be called before get_ready()/done(). Sets _ready_nodes and raises CycleError if cycles found.
- `get_ready()` (L108-132): Returns tuple of nodes ready for processing (no remaining dependencies). Marks returned nodes as _NODE_OUT.
- `done(*nodes)` (L151-196): Marks nodes as processed (_NODE_DONE), decrements successor dependency counts, and updates _ready_nodes with newly available successors.
- `is_active()` (L134-146): Returns True if more progress possible (unprocessed ready nodes or unfinished passed-out nodes).
- `static_order()` (L235-248): Convenience method returning complete topological ordering as iterable.
- `_find_cycle()` (L198-233): DFS-based cycle detection using stack and iterator management.

## Dependencies
- `types.GenericAlias` (L1): For generic type support
- Uses walrus operator (:=) requiring Python 3.8+

## Architecture Patterns
- **State Machine**: Nodes transition through states (counted predecessors → _NODE_OUT → _NODE_DONE)
- **Lazy Evaluation**: Cycle detection only on prepare(), ready nodes computed incrementally
- **Iterator Protocol**: Supports both streaming (__bool__, is_active) and batch (static_order) usage patterns
- **Immutable After Prepare**: Graph structure locked after prepare() call

## Critical Invariants
- prepare() must be called exactly once before get_ready()/done()
- Nodes must be returned by get_ready() before being passed to done()
- _npassedout >= _nfinished (passed out nodes can be pending completion)
- Successor npredecessors counts must reflect all incoming edges (including duplicates)

## Constants
- `_NODE_OUT = -1` (L5): Marker for nodes returned by get_ready()
- `_NODE_DONE = -2` (L6): Marker for nodes processed by done()