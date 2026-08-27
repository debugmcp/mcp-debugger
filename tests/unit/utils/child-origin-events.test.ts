/**
 * Unit tests for the child-origin/child-sourced markers (issues #500/#495).
 *
 * The markers ride DAP event bodies and responses across the proxy→server
 * IPC boundary so the SessionManager can tell the child session's
 * authoritative breakpoint state apart from the parent's provisional stubs.
 */
import { describe, it, expect } from 'vitest';
import {
  markChildOrigin,
  consumeChildOrigin,
  markChildSourced,
  consumeChildSourced
} from '../../../src/utils/child-origin-events.js';

describe('child-origin event marker', () => {
  it('round-trips: mark then consume returns true', () => {
    const body: Record<string, unknown> = { reason: 'changed', breakpoint: { id: 1 } };
    markChildOrigin(body);
    expect(consumeChildOrigin(body)).toBe(true);
  });

  it('consume strips the marker so it cannot leak past the consumer', () => {
    const body: Record<string, unknown> = {};
    markChildOrigin(body);
    consumeChildOrigin(body);
    expect(Object.keys(body)).toEqual([]);
    // A second consume sees a clean body
    expect(consumeChildOrigin(body)).toBe(false);
  });

  it('returns false for unmarked bodies without mutating them', () => {
    const body = { reason: 'changed' };
    expect(consumeChildOrigin(body)).toBe(false);
    expect(body).toEqual({ reason: 'changed' });
  });

  it('is safe on non-objects', () => {
    expect(() => markChildOrigin(undefined)).not.toThrow();
    expect(() => markChildOrigin(null)).not.toThrow();
    expect(() => markChildOrigin('string')).not.toThrow();
    expect(consumeChildOrigin(undefined)).toBe(false);
    expect(consumeChildOrigin(null)).toBe(false);
    expect(consumeChildOrigin(42)).toBe(false);
  });

  it('rejects forged non-boolean marker values but still strips them', () => {
    const body: Record<string, unknown> = { __mcpChildOrigin: 'yes' };
    expect(consumeChildOrigin(body)).toBe(false);
    expect('__mcpChildOrigin' in body).toBe(false);
  });
});

describe('child-sourced response marker', () => {
  it('round-trips and strips independently of the origin marker', () => {
    const response: Record<string, unknown> = { command: 'setBreakpoints', body: {} };
    markChildSourced(response);
    expect(consumeChildOrigin(response)).toBe(false); // different key
    expect(consumeChildSourced(response)).toBe(true);
    expect(consumeChildSourced(response)).toBe(false);
    expect(Object.keys(response).sort()).toEqual(['body', 'command']);
  });

  it('is safe on non-objects', () => {
    expect(() => markChildSourced(null)).not.toThrow();
    expect(consumeChildSourced(undefined)).toBe(false);
  });

  it('survives JSON serialization (the proxy→server IPC hop)', () => {
    const response: Record<string, unknown> = { command: 'setBreakpoints', success: true };
    markChildSourced(response);
    const wire = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;
    expect(consumeChildSourced(wire)).toBe(true);
  });
});
