# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/uuid.py
@source-hash: fe357bff7241e9fd
@generated: 2026-02-09T18:08:19Z

## UUID Module - RFC 4122 Universally Unique Identifiers

Python standard library module implementing RFC 4122 UUID specification, providing immutable UUID objects and generation functions for versions 1, 3, 4, and 5.

### Core Classes

**SafeUUID (L78-82)**: Enum indicating UUID generation safety for multiprocessing
- `safe`, `unsafe`, `unknown` values for thread-safety indication

**UUID (L85-358)**: Immutable UUID object with comprehensive representation capabilities
- Constructor accepts hex string, bytes, bytes_le, fields tuple, or 128-bit int (L139-223)
- Validation for all input formats with detailed error messages
- Comparison operators for sorting/ordering (L248-266)
- String representation in standard hyphenated format (L280-283)

### Key Properties (UUID class)
- `bytes`/`bytes_le`: 16-byte representations in big/little endian (L286-293)
- `fields`: 6-tuple of time/clock/node components (L296-298)
- Individual field accessors: `time_low`, `time_mid`, `time_hi_version`, etc. (L300-332)
- `hex`: 32-char hexadecimal string (L335-336)
- `variant`/`version`: RFC 4122 compliance indicators (L343-357)

### UUID Generation Functions

**uuid1() (L674-710)**: Time-based UUID using MAC address and timestamp
- Uses system `_generate_time_safe` when available for thread safety
- Falls back to manual timestamp calculation with collision detection

**uuid3() (L712-721)**: Name-based using MD5 hash
- Requires namespace UUID and name string/bytes

**uuid4() (L723-725)**: Random UUID using `os.urandom()`

**uuid5() (L727-733)**: Name-based using SHA-1 hash
- Similar to uuid3 but with SHA-1 instead of MD5

### MAC Address Detection System

Platform-specific MAC address retrieval for uuid1():
- **Command execution framework**: `_get_command_stdout()` (L360-388) runs system commands safely
- **Parser functions**: `_find_mac_near_keyword()` (L410-442), `_find_mac_under_heading()` (L473-506)
- **Platform-specific getters**: `_ifconfig_getnode()`, `_ip_getnode()`, `_arp_getnode()`, etc. (L511-575)
- **Fallback hierarchy**: `_GETTERS` list prioritizes native extensions, then OS-specific tools (L629-646)
- **Universal vs local MAC preference**: Prioritizes globally unique MAC addresses (L406-407)

### System Integration

**Platform detection**: Linux, AIX, Darwin, Windows support with different MAC parsing rules (L56-68)
**C extension integration**: Optional `_uuid` module for performance (`_generate_time_safe`, `_UuidCreate`) (L579-588)
**Global state**: Cached node value (`_node`) and timestamp tracking (`_last_timestamp`) for efficiency

### Standard Namespaces
Pre-defined UUID namespaces for uuid3/uuid5: DNS, URL, OID, X500 (L787-790)

### Command Line Interface
`main()` function (L736-782) provides CLI for UUID generation with argparse integration

### Dependencies
- `os`, `sys` for platform detection and random bytes
- `hashlib` for MD5/SHA-1 in uuid3/uuid5  
- `subprocess` for MAC address command execution
- `enum` for SafeUUID implementation
- Optional `_uuid` C extension for performance