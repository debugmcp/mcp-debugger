# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/netbsdlike/netbsd/aarch64.rs
@source-hash: ba2425edbf025f13
@generated: 2026-02-09T18:02:15Z

This file provides architecture-specific type definitions and constants for NetBSD on AArch64 (64-bit ARM) architecture. It's part of the libc crate's Unix BSD NetBSD platform support.

## Primary Purpose
Defines low-level system types and constants needed for AArch64 register access, context switching, and process tracing on NetBSD.

## Key Types

**`greg_t` (L4)**: 64-bit unsigned integer type representing general-purpose registers on AArch64.

**`__cpu_simple_lock_nv_t` (L5)**: Simple lock type using unsigned char for CPU synchronization.

**`__fregset` struct (L8-12)**: Floating-point register set containing:
- `__qregs`: Array of 32 quad-precision floating-point registers
- `__fpcr`: Floating-point control register
- `__fpsr`: Floating-point status register

**`mcontext_t` struct (L14-18)**: Machine context for signal handling and context switching:
- `__gregs`: Array of 32 general-purpose registers
- `__fregs`: Floating-point register set
- `__spare`: Reserved space for future expansion

**`ucontext_t` struct (L20-26)**: Complete user context for signal handling:
- `uc_flags`: Context flags
- `uc_link`: Pointer to linked context
- `uc_sigmask`: Signal mask
- `uc_stack`: Stack information
- `uc_mcontext`: Machine-specific context

**`__c_anonymous__freg` union (L31-37)**: 16-byte aligned floating-point register representation supporting multiple data types (8/16/32/64/128-bit views).

## Conditional Implementations

**PartialEq, Eq, Hash for `__c_anonymous__freg` (L42-64)**: Available only with "extra_traits" feature, compares union fields using unsafe access.

## Constants

**`_ALIGNBYTES` (L68)**: Architecture-specific alignment constant (sizeof(c_int) - 1).

**Process tracing constants (L70-73)**: PT_GETREGS, PT_SETREGS, PT_GETFPREGS, PT_SETFPREGS for ptrace operations.

**Register indices (L75-126)**: Comprehensive mapping of ARM register names to integer constants:
- R0-R15, CPSR for 32-bit compatibility
- X0-X31 for 64-bit general-purpose registers
- ELR, SPSR, TIPDR for special registers

**Register aliases (L128-131)**: Convenient symbolic names (RV=X0, FP=X29, LR=X30, SP=X31, PC=ELR).

## Dependencies
- `crate::prelude::*`: Standard libc prelude types
- `crate::PT_FIRSTMACH`: Base constant for machine-specific ptrace operations

## Architecture Notes
The file maintains both 32-bit ARM (_REG_R*) and 64-bit AArch64 (_REG_X*) register definitions, suggesting compatibility support. The 16-byte alignment requirement for floating-point registers reflects AArch64's SIMD/NEON register architecture.