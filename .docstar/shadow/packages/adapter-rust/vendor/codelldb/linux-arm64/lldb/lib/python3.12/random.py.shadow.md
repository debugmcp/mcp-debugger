# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/random.py
@source-hash: 0693d4ded36916f5
@generated: 2026-02-09T18:09:07Z

## Python's Random Module - Complete Random Number Generation Library

**Purpose:** Comprehensive random number generation library providing pseudorandom and cryptographically secure random number generators with extensive distribution support.

**Core Architecture:**
- Main class `Random` (L110-870) extends `_random.Random` (C implementation) 
- Alternative `SystemRandom` (L876-911) uses OS entropy sources
- Module-level singleton instance `_inst` (L920) exports convenience functions (L921-944)

**Key Classes:**

### Random Class (L110-870)
Primary pseudorandom number generator using Mersenne Twister algorithm.

**Core Methods:**
- `__init__(x=None)` (L126-133): Initialize with optional seed
- `seed(a=None, version=2)` (L135-171): Seed internal state, supports multiple input types
- `getstate()/setstate()` (L173-197): State serialization with version compatibility
- `_randbelow()` variants (L242-271): Internal uniform integer generation

**Distribution Categories:**

**Bytes/Integers:**
- `randbytes(n)` (L284-286): Generate n random bytes
- `randrange(start, stop=None, step=1)` (L291-330): Random from range
- `randint(a, b)` (L332-336): Random integer in [a,b]

**Sequences:**
- `choice(seq)` (L341-348): Pick random element
- `shuffle(x)` (L350-357): In-place list shuffle using Fisher-Yates
- `sample(population, k, *, counts=None)` (L359-452): Sample k unique elements
- `choices(population, weights=None, *, cum_weights=None, k=1)` (L454-489): Weighted sampling with replacement

**Continuous Distributions:**
- `uniform(a, b)` (L494-503): Uniform distribution [a,b)
- `triangular(low=0.0, high=1.0, mode=None)` (L505-528): Triangular distribution
- `normalvariate(mu=0.0, sigma=1.0)` (L530-549): Normal using Kinderman-Monahan
- `gauss(mu=0.0, sigma=1.0)` (L551-587): Faster Gaussian using Box-Muller (not thread-safe)
- `lognormvariate(mu, sigma)` (L589-597): Log-normal distribution
- `expovariate(lambd=1.0)` (L599-617): Exponential distribution
- `vonmisesvariate(mu, kappa)` (L619-659): Von Mises (circular) distribution
- `gammavariate(alpha, beta)` (L661-728): Gamma distribution using Cheng's method
- `betavariate(alpha, beta)` (L730-760): Beta distribution via gamma ratios
- `paretovariate(alpha)` (L762-767): Pareto distribution
- `weibullvariate(alpha, beta)` (L769-778): Weibull distribution

**Discrete Distributions:**
- `binomialvariate(n=1, p=0.5)` (L783-869): Binomial using BTRS algorithm for large n*p

### SystemRandom Class (L876-911)
Cryptographically secure generator using `os.urandom()`.
- Overrides `random()`, `getrandbits()`, `randbytes()` to use OS entropy
- State methods (`seed`, `getstate`, `setstate`) are no-ops or raise NotImplementedError

**Key Constants:**
- `NV_MAGICCONST`, `LOG4`, `SG_MAGICCONST` (L102-104): Distribution algorithm constants
- `BPF = 53`, `RECIP_BPF` (L105-106): Float precision constants
- `TWOPI` (L56): 2π constant from math module

**Dynamic Method Selection:**
`__init_subclass__` (L222-240) automatically assigns optimal `_randbelow` implementation based on available methods in subclasses.

**Module-Level Interface:**
All Random instance methods exposed as module functions via singleton `_inst` for convenient access.

**Testing Framework:**
`_test_generator()` and `_test()` (L950-986) provide performance and statistical validation.

**Process Safety:**
Fork support (L991-992) re-seeds after fork on Unix systems to prevent duplicate sequences.