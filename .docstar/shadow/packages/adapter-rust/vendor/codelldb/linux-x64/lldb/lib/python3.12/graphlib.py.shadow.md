# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/graphlib.py
@source-hash: 7bd338c5a475d110
@generated: 2026-02-09T18:09:41Z

## Primary Purpose
Provides topological sorting functionality for directed acyclic graphs (DAGs) of hashable nodes. The module implements Kahn's algorithm for topological sorting with cycle detection and supports incremental processing.

## Key Classes and Functions

### _NodeInfo (L9-24)
Internal data structure representing graph nodes with:
- `node`: The actual node value
- `npredecessors`: Counter tracking predecessor dependencies (special values: _NODE_OUT=-1 when ready, _NODE_DONE=-2 when processed)
- `successors`: List of dependent nodes (may contain duplicates)

### CycleError (L26-38)
Exception raised when cycles are detected in the graph. Inherits from ValueError. The detected cycle is accessible via args[1] as a list where first and last nodes are identical.

### TopologicalSorter (L41-250)
Main class providing topological sorting capabilities:

**Core State Variables:**
- `_node2info` (L45): Maps nodes to _NodeInfo instances
- `_ready_nodes` (L46): List of nodes ready for processing (None before prepare())
- `_npassedout` (L47): Count of nodes returned by get_ready()
- `_nfinished` (L48): Count of nodes marked done

**Key Methods:**
- `add(node, *predecessors)` (L59-84): Adds nodes and dependency relationships. Cannot be called after prepare().
- `prepare()` (L86-106): Finalizes graph and detects cycles. Must be called before processing.
- `get_ready()` (L108-132): Returns tuple of nodes ready for processing (no remaining dependencies)
- `done(*nodes)` (L151-196): Marks nodes as processed, potentially making their successors ready
- `is_active()` (L134-146): Returns True if more progress possible
- `static_order()` (L235-248): Convenience method returning complete topological ordering
- `_find_cycle()` (L198-233): Internal cycle detection using DFS with stack tracking

## Dependencies
- `types.GenericAlias`: For generic type support
- No external dependencies beyond Python standard library

## Architectural Patterns
- **State Machine**: Three-phase lifecycle (building → prepared → processing)
- **Incremental Processing**: Supports batch processing via get_ready()/done() cycle
- **Lazy Evaluation**: Nodes become ready only when all predecessors are done
- **Error Recovery**: Can continue processing after CycleError detection

## Critical Invariants
- Graph cannot be modified after prepare() is called
- Nodes must be marked done() in same order as returned by get_ready()
- npredecessors field serves as both counter and state indicator
- Cycle detection happens at prepare() time, not during processing
- All nodes and predecessors must be hashable