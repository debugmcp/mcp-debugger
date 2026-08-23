/**
 * LLDB DWARF-parser noise suppression (issue #361) and language-support
 * degradation annotation (issue #441).
 */
import { describe, it, expect } from 'vitest';
import {
  lldbShouldSuppressOutputEvent,
  lldbAnnotateOutputEvent
} from '../../src/interfaces/lldb-policy-shared.js';
import { CppAdapterPolicy } from '../../src/interfaces/adapter-policy-cpp.js';
import { RustAdapterPolicy } from '../../src/interfaces/adapter-policy-rust.js';

const DIE_ERROR_MULTILINE =
  "error: hello_world.exe [0x0000000000002293]: DIE has DW_AT_ranges(DW_FORM_sec_offset 0x000000000000000c) attribute,\n" +
  '  but range extraction failed (invalid range list offset 0xc), please file a bug and attach the file at the\n' +
  '  start of this error message\n';

const MEMBER_ERROR =
  "error: hello_world.exe 0x00002b54: DW_TAG_member '_M_local_buf' refers to type 0x0000000000010ac0 which extends beyond the bounds of 0x00002b4b\n";

describe('lldbShouldSuppressOutputEvent', () => {
  it('suppresses the multi-line DIE/DW_AT_ranges diagnostic', () => {
    expect(lldbShouldSuppressOutputEvent('stderr', DIE_ERROR_MULTILINE)).toBe(true);
  });

  it('suppresses the DW_TAG_member bounds diagnostic', () => {
    expect(lldbShouldSuppressOutputEvent('stderr', MEMBER_ERROR)).toBe(true);
  });

  it('suppresses line-buffered fragments of the DIE diagnostic delivered as separate events', () => {
    for (const line of DIE_ERROR_MULTILINE.split('\n').filter(l => l.trim())) {
      expect(lldbShouldSuppressOutputEvent('stderr', line + '\n'), line).toBe(true);
    }
  });

  it('keeps genuine program stderr, even when it contains the word error:', () => {
    expect(lldbShouldSuppressOutputEvent('stderr', 'error: could not open config file\n')).toBe(false);
    expect(lldbShouldSuppressOutputEvent('stderr', 'panicked at src/main.rs:10\n')).toBe(false);
  });

  it('keeps mixed events where any line is not noise (never partially rewrites)', () => {
    const mixed = MEMBER_ERROR + 'real program output\n';
    expect(lldbShouldSuppressOutputEvent('stderr', mixed)).toBe(false);
  });

  it('never suppresses stdout or empty events', () => {
    expect(lldbShouldSuppressOutputEvent('stdout', MEMBER_ERROR)).toBe(false);
    expect(lldbShouldSuppressOutputEvent('stderr', '\n')).toBe(false);
    expect(lldbShouldSuppressOutputEvent('stderr', '')).toBe(false);
  });

  it('is wired into both the rust and cpp policies', () => {
    expect(RustAdapterPolicy.shouldSuppressOutputEvent?.('stderr', MEMBER_ERROR)).toBe(true);
    expect(CppAdapterPolicy.shouldSuppressOutputEvent?.('stderr', MEMBER_ERROR)).toBe(true);
    expect(RustAdapterPolicy.shouldSuppressOutputEvent?.('stdout', 'hello\n')).toBe(false);
  });
});

const RUST_LANG_SUPPORT_FAILURE =
  "Failed to initialize language support for rust [Errno 2] No such file or directory: 'rustc'\n";

describe('lldbAnnotateOutputEvent (issue #441)', () => {
  it('annotates the rust language-support failure line on console and stderr', () => {
    for (const category of ['console', 'stderr']) {
      const note = lldbAnnotateOutputEvent(category, RUST_LANG_SUPPORT_FAILURE);
      expect(note).toBeDefined();
      expect(note).toContain('Rust type summaries are unavailable');
      expect(note).toContain('CODELLDB_RUST_SYSROOT');
    }
  });

  it('returns undefined for ordinary output', () => {
    expect(lldbAnnotateOutputEvent('console', 'Loading Rust formatters from /sysroot/lib/rustlib/etc\n')).toBeUndefined();
    expect(lldbAnnotateOutputEvent('stderr', 'panicked at src/main.rs:10\n')).toBeUndefined();
    expect(lldbAnnotateOutputEvent('console', '')).toBeUndefined();
  });

  it('ignores stdout — debuggee output can never trigger the annotation', () => {
    expect(lldbAnnotateOutputEvent('stdout', RUST_LANG_SUPPORT_FAILURE)).toBeUndefined();
  });

  it('does not annotate DWARF-noise lines handled by suppression', () => {
    expect(lldbAnnotateOutputEvent('stderr', MEMBER_ERROR)).toBeUndefined();
  });

  it('is wired into the rust policy but not cpp', () => {
    expect(RustAdapterPolicy.annotateOutputEvent?.('console', RUST_LANG_SUPPORT_FAILURE)).toBeDefined();
    expect(CppAdapterPolicy.annotateOutputEvent).toBeUndefined();
  });
});
