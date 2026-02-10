# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/random.py
@source-hash: 0693d4ded36916f5
@generated: 2026-02-09T18:10:07Z

## Purpose
Python's `random` module providing pseudorandom number generation capabilities. Implements the Mersenne Twister algorithm for high-quality random number generation and offers a comprehensive suite of probability distributions and sampling functions.

## Core Architecture

**Random Class (L110-871)**: Main random number generator inheriting from `_random.Random` (C implementation)
- Uses Mersenne Twister with 2^19937-1 period
- Thread-safe `random()` method implemented in C
- VERSION = 3 for state serialization compatibility

**SystemRandom Class (L876-911)**: OS-based cryptographically secure random generator
- Uses `os.urandom()` for entropy from OS sources (/dev/urandom, CryptGenRandom)
- Cannot be seeded or have state saved/restored
- Suitable for security-sensitive applications

## Key Methods & Components

### Initialization & State Management
- `__init__(self, x=None)` (L126-134): Initialize with optional seed
- `seed(a=None, version=2)` (L135-172): Seed initialization with multiple type support
- `getstate()/setstate()` (L173-198): State serialization/restoration
- `__init_subclass__()` (L222-241): Dynamic method selection for subclasses

### Internal Random Generation
- `_randbelow_with_getrandbits()` (L242-250): Efficient integer generation using bit operations
- `_randbelow_without_getrandbits()` (L252-269): Fallback using floating-point random()

### Integer Generation
- `randrange(start, stop=None, step=_ONE)` (L291-330): Range-based random integers
- `randint(a, b)` (L332-336): Inclusive range integers

### Sequence Operations
- `choice(seq)` (L341-348): Single random element selection
- `shuffle(x)` (L350-357): In-place Fisher-Yates shuffle
- `sample(population, k, *, counts=None)` (L359-452): Sampling without replacement
- `choices(population, weights=None, *, cum_weights=None, k=1)` (L454-489): Weighted sampling with replacement

### Continuous Distributions
- `uniform(a, b)` (L494-503): Uniform distribution
- `triangular(low=0.0, high=1.0, mode=None)` (L505-528): Triangular distribution
- `normalvariate(mu=0.0, sigma=1.0)` (L530-549): Normal distribution (Kinderman-Monahan method)
- `gauss(mu=0.0, sigma=1.0)` (L551-587): Gaussian using Box-Muller transformation (faster, not thread-safe)
- `lognormvariate()` (L589-597): Log-normal distribution
- `expovariate()` (L599-617): Exponential distribution
- `vonmisesvariate()` (L619-659): Von Mises circular distribution
- `gammavariate()` (L661-728): Gamma distribution (multiple algorithms based on alpha)
- `betavariate()` (L730-760): Beta distribution
- `paretovariate()` (L762-767): Pareto distribution
- `weibullvariate()` (L769-778): Weibull distribution

### Discrete Distributions
- `binomialvariate(n=1, p=0.5)` (L783-869): Binomial distribution with BTRS algorithm for large n*p

## Module-Level Interface
Global instance `_inst` (L920) provides module-level functions (L921-944) for convenience, sharing state across all uses.

## Constants
- `NV_MAGICCONST`, `LOG4`, `SG_MAGICCONST` (L102-104): Mathematical constants for distribution algorithms
- `BPF = 53`, `RECIP_BPF` (L105-106): Floating-point precision constants
- `TWOPI` (L56): 2π constant from math module

## Testing & Fork Support
- `_test()` function (L967-986): Performance and statistical testing
- Fork support (L991-992): Automatic reseeding after fork on Unix systems

## Dependencies
Heavy reliance on math module functions, os.urandom for SystemRandom, _random C module for core MT implementation, and various standard library modules for utilities.