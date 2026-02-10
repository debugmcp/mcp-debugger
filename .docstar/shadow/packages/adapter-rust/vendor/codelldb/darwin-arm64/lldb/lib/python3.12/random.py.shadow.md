# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/random.py
@source-hash: 0693d4ded36916f5
@generated: 2026-02-09T18:07:26Z

**Purpose**: Python standard library's random number generation module, providing pseudorandom number generators and various probability distributions.

**Architecture**: Built around a base `Random` class that wraps the C-implemented Mersenne Twister generator (`_random.Random`), with module-level convenience functions that delegate to a shared global instance.

## Core Classes

**Random (L110-870)**: Main random number generator class
- Inherits from `_random.Random` (C implementation)
- `__init__(L126-133)`: Initializes with optional seed, sets up Gaussian cache
- `seed(L135-171)`: Supports multiple seed types (None, int, float, str, bytes, bytearray) with version compatibility
- `getstate/setstate(L173-197)`: State serialization with version handling (supports v2/v3 compatibility)
- `_randbelow(L242-271)`: Core method for generating random integers in range [0,n), with two implementations based on available methods
- `__init_subclass__(L222-240)`: Automatically selects optimal `_randbelow` implementation for subclasses

**SystemRandom (L876-910)**: Cryptographically secure random generator
- Uses OS entropy sources (`os.urandom`)
- Overrides `random()`, `getrandbits()`, `randbytes()` to use OS sources
- Stubs `seed()`, raises `NotImplementedError` for state methods

## Key Distribution Methods

**Integer Generation**:
- `randrange(L291-330)`: Range selection with step support, optimized fast paths
- `randint(L332-336)`: Inclusive range wrapper around randrange

**Sequence Operations**:
- `choice(L341-348)`: Random element selection with NumPy accommodation
- `shuffle(L350-357)`: Fisher-Yates in-place shuffling
- `sample(L359-452)`: Sampling without replacement, uses pool vs set optimization based on size ratios
- `choices(L454-489)`: Weighted sampling with replacement

**Continuous Distributions**:
- `uniform(L494-503)`: Linear interpolation
- `triangular(L505-528)`: Mode-based triangular distribution
- `normalvariate(L530-549)`: Kinderman-Monahan method
- `gauss(L551-587)`: Box-Muller transform with cached value optimization
- `lognormvariate(L589-597)`: Exp of normal variate
- `expovariate(L599-617)`: Inverse transform method
- `vonmisesvariate(L619-659)`: Circular distribution with rejection sampling
- `gammavariate(L661-728)`: Multi-algorithm approach based on alpha value
- `betavariate(L730-760)`: Uses gamma variates
- `paretovariate(L762-767)`: Power law distribution
- `weibullvariate(L769-778)`: Scale/shape parameterized

**Discrete Distributions**:
- `binomialvariate(L783-869)`: Uses geometric method for small n*p, BTRS algorithm for large cases

## Module-Level Interface

**Global Instance (L920-944)**: Creates shared `Random()` instance and exports its methods as module functions for convenience.

**Constants**:
- `NV_MAGICCONST, LOG4, SG_MAGICCONST (L102-104)`: Mathematical constants for distribution algorithms
- `BPF, RECIP_BPF (L105-106)`: Float precision constants

**Dependencies**: Math functions, `os.urandom`, `_random` C module, `hashlib`/`_sha2` for seeding, various utility imports for sequence operations.

**Testing**: `_test()` function (L967-985) provides performance and correctness validation.

**Fork Safety**: Automatic reseeding after fork on Unix systems (L991-992).