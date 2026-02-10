# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/uuid.py
@source-hash: fe357bff7241e9fd
@generated: 2026-02-09T18:07:36Z

**Primary Purpose**: Standard library module providing UUID (Universally Unique Identifier) objects and generation functions according to RFC 4122, supporting UUID versions 1, 3, 4, and 5.

**Key Classes**:
- `SafeUUID` (L78-83): Enum indicating multiprocessing safety of UUID generation with values `safe`, `unsafe`, `unknown`
- `UUID` (L85-358): Immutable UUID object representing 128-bit identifiers
  - Constructor accepts hex string, bytes, bytes_le, fields tuple, or int (L139-169)
  - Properties: `bytes` (L286), `fields` (L296), `time_low/mid/hi_version` (L301-310), `clock_seq` (L326), `node` (L331), `hex` (L335), `urn` (L339), `variant` (L343), `version` (L354)
  - Implements comparison operators (L240-266), hashing (L268), string conversion (L280-283)
  - Immutable via `__setattr__` override (L277-278)
  - Pickle support via `__getstate__`/`__setstate__` (L225-238)

**Core UUID Generation Functions**:
- `uuid1(node, clock_seq)` (L674-710): Time-based UUID with MAC address and timestamp
- `uuid3(namespace, name)` (L712-721): MD5 hash-based UUID from namespace and name
- `uuid4()` (L723-725): Random UUID using `os.urandom(16)`
- `uuid5(namespace, name)` (L727-733): SHA-1 hash-based UUID from namespace and name

**Hardware Address Detection**:
- `getnode()` (L650-669): Primary function to get 48-bit hardware address, cached in global `_node`
- Platform-specific getters: `_ifconfig_getnode()` (L511), `_ip_getnode()` (L521), `_arp_getnode()` (L529), `_netstat_getnode()` (L562)
- Fallback: `_random_getnode()` (L607-620) generates random MAC with multicast bit set
- Command execution helper: `_get_command_stdout()` (L360-388)
- MAC parsing utilities: `_parse_mac()` (L445-470), `_is_universal()` (L406-407)

**Platform Detection & Configuration**:
- Platform flags: `_AIX`, `_LINUX` (L56-62) for behavior customization
- MAC address formatting: `_MAC_DELIM`, `_MAC_OMITS_LEADING_ZEROES` (L64-68)
- OS-specific getter lists: `_OS_GETTERS`, `_GETTERS` (L629-646)

**C Extension Integration**:
- Optional `_uuid` module import (L579-588) for native UUID generation
- Functions: `_generate_time_safe`, `_UuidCreate`, `_has_uuid_generate_time_safe`

**Constants**:
- Variant types: `RESERVED_NCS`, `RFC_4122`, `RESERVED_MICROSOFT`, `RESERVED_FUTURE` (L70-72)
- Standard namespaces: `NAMESPACE_DNS`, `NAMESPACE_URL`, `NAMESPACE_OID`, `NAMESPACE_X500` (L787-790)

**Command Line Interface**:
- `main()` (L736-782): CLI for UUID generation with argparse support

**Architecture Notes**:
- Lazy initialization pattern for hardware address detection
- Preference for universally administered MAC addresses over locally administered
- Timestamp collision prevention in uuid1() via `_last_timestamp` tracking (L672, L696-698)
- Cross-platform compatibility with fallback mechanisms
- Immutable design with comprehensive validation