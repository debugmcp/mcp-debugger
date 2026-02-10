# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/random.py
@source-hash: 0693d4ded36916f5
@generated: 2026-02-09T18:08:04Z

## Primary Purpose
Python's standard library random number generation module providing pseudorandom number generators based on Mersenne Twister algorithm and cryptographic OS entropy. Offers comprehensive distribution functions, sequence operations, and both deterministic and secure random sources.

## Core Architecture

**Random Class (L110-870)** - Main pseudorandom generator extending `_random.Random`
- Inherits Mersenne Twister implementation from C extension
- `seed()` (L135-172): Handles multiple seed types with SHA-512 hashing for v2
- `getstate()`/`setstate()` (L173-198): State serialization with version compatibility
- `gauss_next` attribute: Cached value for Box-Muller gaussian generation optimization

**SystemRandom Class (L876-911)** - Cryptographically secure generator
- Uses `os.urandom()` instead of deterministic algorithm
- `random()` (L885-887): Generates from 7 random bytes
- `getrandbits()` (L889-895): Direct entropy extraction
- State methods disabled (raise NotImplementedError)

## Integer Generation Strategy

**Dynamic Method Selection (L222-241)** - `__init_subclass__` automatically assigns optimal `_randbelow` implementation:
- `_randbelow_with_getrandbits` (L242-250): Efficient for arbitrary ranges using bit rejection
- `_randbelow_without_getrandbits` (L252-269): Fallback using `random()` with warning for large ranges

**Core Integer Methods:**
- `randrange()` (L291-330): Range selection with step support, optimized fast paths
- `randint()` (L332-336): Inclusive endpoint wrapper

## Sequence Operations

**sample() (L359-452)** - Sophisticated sampling without replacement:
- Automatic algorithm selection based on k/n ratio
- Pool tracking (n <= setsize): List shuffling approach
- Selection tracking (n > setsize): Set-based duplicate avoidance
- `counts` parameter: Weighted population support via recursive sampling

**choices() (L454-489)** - Weighted sampling with replacement using cumulative weights and binary search

**shuffle() (L350-358)** - Fisher-Yates in-place shuffling

## Distribution Functions

**Continuous Distributions:**
- `uniform()` (L494-503): Linear transformation of `random()`
- `normalvariate()` (L530-549): Kinderman-Monahan ratio method
- `gauss()` (L551-587): Box-Muller with caching (thread-unsafe optimization)
- `gammavariate()` (L661-728): Multiple algorithms based on alpha parameter
- Additional: triangular, lognormal, exponential, von Mises, beta, Pareto, Weibull

**Discrete Distributions:**
- `binomialvariate()` (L783-869): Geometric method (small np) + BTRS algorithm (large np)

## Module-Level Interface

**Global Instance (L920-944)** - Single shared `Random()` instance with methods exported as module functions for convenience. Automatic reseeding after fork operations (L991-992).

**Constants:**
- Mathematical constants for distribution algorithms (L102-107)
- `TWOPI`, `NV_MAGICCONST`, `SG_MAGICCONST`, etc.

## Key Dependencies
- `_random` C extension for core Mersenne Twister
- `os.urandom` for cryptographic entropy
- Math functions for distribution calculations
- SHA-512 for robust seed hashing

## Critical Invariants
- Thread safety only for basic `random()` calls
- `gauss()` requires external locking for thread safety
- State compatibility across Python versions via version tracking
- Automatic fork handling to prevent duplicate sequences in child processes