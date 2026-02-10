# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/util/linked_list.rs
@source-hash: a8aaae8ec2ddd2e4
@generated: 2026-02-09T18:07:02Z

## Purpose
Intrusive doubly-linked list implementation for Tokio's internal use, optimized for pinned nodes and unsafe performance-critical operations. Supports tracking nodes that must remain pinned in memory throughout their list lifetime.

## Core Types

**LinkedList<L, T> (L19-28)**: Main intrusive linked list with head/tail pointers and phantom marker for link type. Features:
- `new()` (L108-114): const constructor for empty list
- `push_front()` (L119-138): adds element at head, uses ManuallyDrop to avoid drops
- `pop_front()` (L142-158): removes and returns head element
- `pop_back()` (L162-178): removes and returns tail element
- `is_empty()` (L181-188): checks if list contains any nodes
- `remove()` (L200-232): unsafe removal by node pointer, requires caller guarantees
- `last()` (L252-255): returns reference to tail element (feature-gated)

**Link trait (L43-68)**: Unsafe trait defining how types integrate with the list system:
- `Handle`: pointer-like type for managing nodes
- `Target`: actual node type
- `as_raw()` (L54): converts handle to NonNull pointer
- `from_raw()` (L57): unsafe conversion from pointer to handle
- `pointers()` (L67): accesses node's prev/next pointers

**Pointers<T> (L71-73)**: Container for prev/next pointers with UnsafeCell interior:
- `new()` (L423-431): creates empty pointer set
- `get_prev()/get_next()` (L433-440): safe pointer access via addr_of!
- `set_prev()/set_next()` (L442-453): mutable pointer updates via addr_of_mut!

**PointersInner<T> (L89-99)**: Actual pointer storage marked !Unpin with PhantomPinned to prevent noalias optimization issues.

## Advanced Features

**GuardedLinkedList<L, T> (L346-352)**: Circular variant using guard node instead of head/tail pointers (feature-gated). Guard node links to actual head/tail, making all pointers non-null.
- `into_guarded()` (L358-381): converts regular list to guarded version
- `pop_back()` (L402-415): removal maintaining circular structure

**DrainFilter (L267-271)**: Iterator that removes elements matching predicate (io-driver feature):
- `drain_filter()` (L274-284): creates filtering iterator
- `next()` (L294-306): advances and conditionally removes nodes

**for_each() (L312-325)**: Traverses list applying function to each handle (taskdump feature).

## Safety Architecture

- Extensive use of unsafe code with documented preconditions
- ManuallyDrop prevents premature drops during insertion
- Raw pointer manipulation avoids reference creation (Stacked Borrows compliance)
- PhantomPinned prevents noalias attribute on mutable references
- Link trait requires pinned Target types

## Memory Management Patterns

- Nodes must remain pinned for list lifetime
- List doesn't automatically drop nodes on destruction (caller responsibility)
- Uses NonNull for null pointer optimization
- Careful pointer manipulation to maintain list invariants

## Test Infrastructure (L469-798)

Comprehensive test module with Entry type implementing Link trait, covering push/pop operations, removal by address, and fuzz testing infrastructure.