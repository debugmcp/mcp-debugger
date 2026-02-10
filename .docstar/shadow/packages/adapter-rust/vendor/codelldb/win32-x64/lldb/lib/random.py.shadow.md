# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/random.py
@source-hash: 0693d4ded36916f5
@generated: 2026-02-09T18:13:08Z

## Purpose
Python's `random` module providing comprehensive random number generation capabilities including uniform distribution, statistical distributions, sequence operations, and cryptographically secure random sources. Core implementation extends C-based Mersenne Twister generator (`_random.Random`).

## Key Classes

### Random (L110-870)
Primary random number generator class extending `_random.Random`. Provides:
- **State Management**: `seed()` (L135-172), `getstate()` (L173-175), `setstate()` (L177-197)
- **Integer Generation**: `randrange()` (L291-330), `randint()` (L332-336)
- **Sequence Operations**: `choice()` (L341-348), `shuffle()` (L350-357), `sample()` (L359-452), `choices()` (L454-489)
- **Real-valued Distributions**: `uniform()` (L494-503), `triangular()` (L505-528), `normalvariate()` (L530-549), `gauss()` (L551-587), `lognormvariate()` (L589-597), `expovariate()` (L599-617), `vonmisesvariate()` (L619-659), `gammavariate()` (L661-728), `betavariate()` (L730-760), `paretovariate()` (L762-767), `weibullvariate()` (L769-778)
- **Discrete Distributions**: `binomialvariate()` (L783-869)
- **Byte Generation**: `randbytes()` (L284-286)

Key implementation details:
- Uses `_randbelow()` internal method with two strategies: `_randbelow_with_getrandbits()` (L242-250) for subclasses with `getrandbits()`, `_randbelow_without_getrandbits()` (L252-269) fallback
- Gaussian caching via `gauss_next` attribute (L133, L580-585)
- Complex algorithms: BTRS for binomial (L832-869), Kinderman-Monahan for normal (L536-549)

### SystemRandom (L876-911)
OS-based cryptographically secure generator using `os.urandom()`. Overrides:
- `random()` (L885-887): Uses 7 bytes from urandom
- `getrandbits()` (L889-895): Direct urandom implementation
- `randbytes()` (L897-901): Direct urandom passthrough
- `seed()` (L903-905): No-op stub
- State methods raise `NotImplementedError` (L907-910)

## Module-Level Interface
Global instance `_inst` (L920) exports all methods as module functions (L921-944), providing convenient stateful API.

## Dependencies
- Core: `_random` (C extension), `os.urandom`, `math` functions
- Statistical: Uses advanced mathematical algorithms (gamma function, logarithms)
- Hashing: Prefers `_sha2.sha512` over `hashlib.sha512` for seeding (L66-71)

## Architecture Patterns
- **Strategy Pattern**: `__init_subclass__()` (L222-240) selects `_randbelow` implementation based on available methods
- **Template Method**: Core distributions build on `random()`, `getrandbits()`, `_randbelow()`
- **Singleton Pattern**: Module-level functions share single `_inst`
- **State Preservation**: Comprehensive state management with version compatibility (L177-197)

## Critical Constants
- `NV_MAGICCONST` (L102): Normal distribution optimization
- `BPF` (L105): 53-bit float precision
- `VERSION = 3` (L124): State serialization version

## Testing & Fork Support
- `_test()` (L967-985): Statistical validation framework
- Fork safety via `os.register_at_fork()` (L991-992) for process isolation

## Thread Safety
`gauss()` method explicitly not thread-safe due to cached state (L557). `random()` method is thread-safe per Mersenne Twister implementation.