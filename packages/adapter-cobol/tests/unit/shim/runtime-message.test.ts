import { describe, expect, it, vi } from 'vitest';
import type { EngineRequester } from '../../../src/shim/engine-client.js';
import { formatRuntimeMessage, readRuntimeMessage, TARGET_ABI_EXPRESSION } from '../../../src/shim/runtime-message.js';

function reader(values: bigint[], longBits = 64) {
  return { word: vi.fn(async (i: number) => values[i - 1]), string: vi.fn(async (_address: bigint, precision?: number) => 'WS-CELL'.slice(0, precision)), longBits };
}

describe('bounded libcob printf formatting', () => {
  it('formats the actual bounds and numeric-check messages', async () => {
    expect(await formatRuntimeMessage("subscript of '%s' out of bounds: %d", reader([0x2000n, 5n]))).toBe("subscript of 'WS-CELL' out of bounds: 5");
    expect(await formatRuntimeMessage("'%s' (Type: %s) not numeric: '%s'", reader([1n, 2n, 3n]))).toBe("'WS-CELL' (Type: WS-CELL) not numeric: 'WS-CELL'");
  });

  it('handles integer promotions, length modifiers, signs, width and precision', async () => {
    expect(await formatRuntimeMessage('%hhd %hu %+06d %#08x %.0u %#.0o %c %%', reader([255n, 65535n, -12n, 42n, 0n, 0n, 65n])))
      .toBe('-1 65535 -00012 0x00002a  0 A %');
    expect(await formatRuntimeMessage('%ld %lld %zu %p', reader([0xffffffffn, -1n, 4294967296n, 4660n], 32)))
      .toBe('-1 -1 4294967296 0x1234');
    expect(await formatRuntimeMessage('%ld', reader([0xffffffffn], 64))).toBe('4294967295');
    expect(await formatRuntimeMessage('%*.*s!', reader([-10n, 2n, 1n]))).toBe('WS        !');
  });

  it.each(['%n', '%f', '%ls', '%2$s', '%', '%1025s', '%999999999999s', '%.1025s'])('rejects unsupported or excessive format %s', async format => {
    await expect(formatRuntimeMessage(format, reader([1n]))).rejects.toThrow();
  });

  it('caps arguments, format size and total output', async () => {
    await expect(formatRuntimeMessage('%d'.repeat(33), reader(Array(33).fill(1n)))).rejects.toThrow('argument limit');
    await expect(formatRuntimeMessage('x'.repeat(1025), reader([]))).rejects.toThrow('format exceeds');
    await expect(formatRuntimeMessage('%1024d'.repeat(4) + '!', reader([1n, 1n, 1n, 1n]))).rejects.toThrow('message exceeds');
  });
});

function target(triple: string, registers: Record<string, bigint>, stack: bigint[], stackOffset = 0, format = '%s: %d %d %d %d %d %d %d %d') {
  const stackBytes = Buffer.alloc(stackOffset + stack.length * 8);
  stack.forEach((value, i) => stackBytes.writeBigUInt64LE(BigInt.asUintN(64, value), stackOffset + i * 8));
  const memory = new Map<bigint, Buffer>([[0x1000n, Buffer.from(format + '\0')], [0x2000n, Buffer.from('WS-CELL\0')], [0x3000n, stackBytes]]);
  const expressions: string[] = [];
  const engine: EngineRequester = { request: vi.fn(async (command, raw, timeout) => {
    expect(timeout).toBeGreaterThan(0);
    expect(timeout).toBeLessThanOrEqual(2000);
    const args = raw as { expression: string; frameId: number; memoryReference: string; count: number };
    let body: unknown;
    if (command === 'evaluate') {
      expect(args.frameId).toBe(17);
      expressions.push(args.expression);
      const register = /^\/nat \(unsigned long long\)\$(\w+)$/.exec(args.expression)?.[1];
      const value = args.expression === TARGET_ABI_EXPRESSION ? triple + '|8|1'
        : args.expression === '/py lldb.frame.GetCFA()' ? '12288' : register ? registers[register]?.toString() : undefined;
      if (value !== undefined) body = { result: value };
    } else if (command === 'readMemory') {
      expect(args.count).toBeLessThanOrEqual(128);
      const address = BigInt(args.memoryReference);
      for (const [base, bytes] of memory) {
        if (address >= base && address < base + BigInt(bytes.length)) {
          const offset = Number(address - base);
          body = { data: bytes.subarray(offset, offset + args.count).toString('base64') };
        }
      }
    }
    return { seq: 1, type: 'response', request_seq: 1, command, success: body !== undefined, body };
  }) };
  return { engine, expressions, memory };
}

describe('target ABI runtime arguments', () => {
  it.each([
    ['x86_64-unknown-linux-gnu', { rdi: 0x1000n, rsi: 0x2000n, rdx: 1n, rcx: 2n, r8: 3n, r9: 4n }, [5n, 6n, 7n, 8n], 0],
    ['x86_64-pc-windows-msvc', { rcx: 0x1000n, rdx: 0x2000n, r8: 1n, r9: 2n }, [3n, 4n, 5n, 6n, 7n, 8n], 32],
    ['aarch64-unknown-linux-gnu', { x0: 0x1000n, x1: 0x2000n, x2: 1n, x3: 2n, x4: 3n, x5: 4n, x6: 5n, x7: 6n }, [7n, 8n], 0],
    ['arm64-apple-macosx', { x0: 0x1000n }, [0x2000n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n], 0]
  ] as const)('reads register and spilled arguments for %s', async (triple, registers, stack, offset) => {
    const { engine, expressions } = target(triple, registers, [...stack], offset);
    expect(await readRuntimeMessage(engine, 17)).toMatchObject({ message: 'WS-CELL: 1 2 3 4 5 6 7 8' });
    expect(expressions).toContain('/py lldb.frame.GetCFA()');
    expect(expressions.every(expression => expression.startsWith('/py ') || /^\/nat \(unsigned long long\)\$\w+$/.test(expression))).toBe(true);
  });

  it('reports unsupported ABIs without guessing registers from the host', async () => {
    const { engine, expressions } = target('riscv64-unknown-linux-gnu', {}, []);
    expect(await readRuntimeMessage(engine, 17)).toEqual({ format: undefined, unavailable: 'unsupported target ABI' });
    expect(expressions).toEqual([TARGET_ABI_EXPRESSION]);
  });

  it('preserves the known format when an argument cannot be read', async () => {
    const { engine } = target('x86_64-unknown-linux-gnu', { rdi: 0x1000n }, [], 0, '%s');
    expect(await readRuntimeMessage(engine, 17)).toEqual({ format: '%s', unavailable: 'evaluate unavailable' });
  });

  it('bounds unterminated strings and rejects short stack reads', async () => {
    const t = target('arm64-apple-macosx', { x0: 0x1000n }, [0x2000n], 0, '%s');
    t.memory.set(0x2000n, Buffer.alloc(1024, 65));
    expect((await readRuntimeMessage(t.engine, 17)).unavailable).toMatch(/unterminated/);
    t.memory.set(0x3000n, Buffer.from([1]));
    expect((await readRuntimeMessage(t.engine, 17)).unavailable).toBe('argument stack unreadable');
  });

  it('supports bounded non-terminated string precision and null strings', async () => {
    const t = target('x86_64-unknown-linux-gnu', { rdi: 0x1000n, rsi: 0x2000n, rdx: 0n }, [], 0, '%.2s %s');
    expect((await readRuntimeMessage(t.engine, 17)).message).toBe('WS (null)');
  });
});
