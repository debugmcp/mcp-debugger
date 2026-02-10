# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/net/tcp/split_owned.rs
@source-hash: 70bbd9fb62c68b96
@generated: 2026-02-09T18:03:00Z

## Tokio TCP Stream Owned Split Module

Provides zero-overhead splitting of TcpStream into independently owned read and write halves with Arc-based reference counting, enabling safe concurrent access without generic trait overhead.

### Core Functionality

**split_owned() (L59-69)**: Creates owned halves from a TcpStream by wrapping in Arc. Both halves share the same Arc<TcpStream> reference, with write half getting `shutdown_on_drop: true` by default.

**reunite() (L71-83)**: Reconstructs original TcpStream from halves using Arc::ptr_eq() to verify they originated from same stream. Uses Arc::try_unwrap() after dropping write half's shutdown behavior.

### Key Types

**OwnedReadHalf (L35-37)**: Contains Arc<TcpStream> for shared ownership. Implements AsyncRead trait (L333-341) delegating to inner stream's poll_read_priv().

**OwnedWriteHalf (L54-57)**: Contains Arc<TcpStream> plus shutdown_on_drop boolean flag. Implements AsyncWrite trait (L460-495) with custom drop behavior (L452-458) that conditionally shuts down write direction.

**ReuniteError (L88)**: Error type for failed reunite attempts between mismatched halves, implements Display and Error traits.

### Read Half Methods (L101-331)
- **poll_peek()/peek()** (L145-195): Non-blocking and async data inspection without consumption  
- **ready()/readable()** (L220-239): Readiness state checking with Interest flags
- **try_read()/try_read_vectored()** (L264-295): Non-blocking read operations
- **try_read_buf()** (L317-319): BufMut-based reading (conditional compilation)
- **peer_addr()/local_addr()** (L323-330): Address accessors

### Write Half Methods (L343-450) 
- **forget()** (L356-359): Disables shutdown-on-drop behavior for graceful cleanup
- **ready()/writable()** (L384-401): Write readiness checking
- **try_write()/try_write_vectored()** (L416-439): Non-blocking write operations
- **Address accessors** (L442-449): Same as read half

### Implementation Details

**AsyncWrite for OwnedWriteHalf**: poll_flush() is no-op (L482-485), poll_shutdown() performs write-direction shutdown and disables drop behavior (L488-494).

**AsRef implementations** (L497-507): Both halves provide access to underlying TcpStream.

**Architectural constraint**: API ensures exactly two Arc references exist, enabling safe reunite unwrapping.