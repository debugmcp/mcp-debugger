# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/graphlib.py
@source-hash: 7bd338c5a475d110
@generated: 2026-02-09T18:08:46Z

## Primary Purpose
Python's graphlib module provides topological sorting functionality for directed acyclic graphs (DAGs). It implements Kahn's algorithm for topological ordering with cycle detection.

## Core Classes

### _NodeInfo (L9-24)
Internal helper class storing node metadata with `__slots__` optimization:
- `node`: The actual node object being tracked
- `npredecessors`: Counter tracking remaining dependencies (0 = ready, -1 = passed out, -2 = done)
- `successors`: List of nodes that depend on this node (allows duplicates)

### CycleError (L26-39)
Exception subclass of ValueError raised when cycles are detected in the graph. The detected cycle is accessible via `args[1]` and contains the cycle path as a list where first and last nodes are identical.

### TopologicalSorter (L41-250)
Main public class implementing topological sorting with incremental processing support.

**Key State Variables:**
- `_node2info` (L45): Dict mapping nodes to _NodeInfo objects
- `_ready_nodes` (L46): List of nodes ready for processing (None before prepare())
- `_npassedout` (L47): Counter of nodes returned by get_ready()
- `_nfinished` (L48): Counter of nodes marked as done()

**Core Methods:**
- `add(node, *predecessors)` (L59-85): Adds node with dependencies, builds predecessor/successor relationships
- `prepare()` (L86-107): Finalizes graph, detects cycles, initializes ready nodes list
- `get_ready()` (L108-132): Returns tuple of nodes with all dependencies satisfied, marks them as _NODE_OUT
- `done(*nodes)` (L151-196): Marks nodes as processed (_NODE_DONE), updates successor dependency counts
- `is_active()` (L134-146): Returns True if more progress possible (ready nodes exist or unfinished nodes remain)
- `static_order()` (L235-248): Generator yielding complete topological order in one pass

**Algorithm Implementation:**
- `_find_cycle()` (L198-233): DFS-based cycle detection using stack tracking and backtracking
- Uses node state constants: `_NODE_OUT = -1`, `_NODE_DONE = -2` (L5-6)

## Key Dependencies
- `types.GenericAlias` for generic type support (L250)

## Usage Pattern
1. Create TopologicalSorter, optionally with initial graph dict
2. Add nodes and dependencies via add()
3. Call prepare() to finalize and check cycles
4. Iteratively call get_ready() → process nodes → done() until is_active() returns False
5. Alternative: Use static_order() for simple one-pass iteration

## Critical Invariants
- prepare() must be called before get_ready(), done(), or is_active()
- Nodes from get_ready() must be marked done() before they unblock successors
- Graph cannot be modified after prepare()
- npredecessors field encodes node state: ≥0 (pending), -1 (ready), -2 (done)