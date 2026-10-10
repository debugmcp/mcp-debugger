/**
 * The attach-addressing verdict (issue #903): a request against a language's
 * declaration, before any session state changes.
 */
import { describe, it, expect } from 'vitest';
import type { AdapterModes } from '@debugmcp/shared';
import { attachLocalityOf, classifyAttachAddressing } from '../../../../src/session/attach/attach-addressing.js';

const PORT_ONLY: AdapterModes = {
  launch: true,
  attach: 'spawn',
  attachBy: ['port'],
  attachHints: { processId: 'start the JVM with -agentlib:jdwp=... and pass port' }
};
const PID_ONLY: AdapterModes = {
  launch: true,
  attach: 'spawn',
  attachBy: ['processId'],
  attachHints: { port: 'CodeLLDB attaches by PID' }
};
const PID_PORT_URI: AdapterModes = { launch: true, attach: 'spawn', attachBy: ['processId', 'port', 'adapterConfig'] };
const PORT_URI: AdapterModes = {
  launch: true,
  attach: 'spawn',
  attachBy: ['port', 'adapterConfig'],
  attachHints: { processId: 'pass adapterConfig.vmServiceUri' }
};
const UNDECLARED: AdapterModes = { launch: true, attach: 'spawn' };

describe('classifyAttachAddressing', () => {
  it('accepts the forms the language declares and records locality', () => {
    expect(classifyAttachAddressing('java', { port: 5005 }, PORT_ONLY)).toEqual({ ok: true, locality: 'loopback', declared: true });
    expect(classifyAttachAddressing('java', { host: '10.0.0.5', port: 5005 }, PORT_ONLY)).toEqual({ ok: true, locality: 'remote', declared: true });
    expect(classifyAttachAddressing('cpp', { processId: 4242 }, PID_ONLY)).toEqual({ ok: true, locality: 'pid', declared: true });
    expect(classifyAttachAddressing('javascript', { processId: '4242', port: 9229 }, PID_PORT_URI)).toEqual({ ok: true, locality: 'pid', declared: true });
  });

  it('refuses processId by name on a port-only language, quoting the hint and the accepted forms', () => {
    const verdict = classifyAttachAddressing('java', { processId: 4242 }, PORT_ONLY);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.error).toMatch(/'java' does not attach by processId/);
    expect(verdict.error).toMatch(/-agentlib:jdwp/);
    expect(verdict.error).toMatch(/takes: port/);
  });

  it('refuses processId even when a port is given too (no more silent drop)', () => {
    const verdict = classifyAttachAddressing('python', { processId: 4242, port: 5678 }, PORT_ONLY);
    expect(verdict.ok).toBe(false);
  });

  it('refuses port by name on a PID-only language', () => {
    const verdict = classifyAttachAddressing('cpp', { port: 1234 }, PID_ONLY);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.error).toMatch(/'cpp' does not attach by port/);
    expect(verdict.error).toMatch(/CodeLLDB attaches by PID/);
    expect(verdict.error).toMatch(/takes: processId/);
  });

  it('refuses a remote host on a PID-only language but tolerates a loopback one', () => {
    expect(classifyAttachAddressing('cpp', { processId: 1, host: '10.0.0.5' }, PID_ONLY).ok).toBe(false);
    const loopback = classifyAttachAddressing('cpp', { processId: 1, host: 'localhost' }, PID_ONLY);
    expect(loopback).toEqual({ ok: true, locality: 'pid', declared: true });
  });

  it('refuses a request that names neither processId nor port on a language with no adapterConfig form', () => {
    const java = classifyAttachAddressing('java', {}, PORT_ONLY);
    expect(java.ok).toBe(false);
    if (!java.ok) expect(java.error).toMatch(/'java' attach needs port/);
    const cpp = classifyAttachAddressing('cpp', { adapterConfig: { program: '/x' } }, PID_ONLY);
    expect(cpp.ok).toBe(false);
    if (!cpp.ok) expect(cpp.error).toMatch(/'cpp' attach needs processId/);
  });

  it('leaves the empty request to the adapter when it accepts adapterConfig addressing', () => {
    expect(classifyAttachAddressing('dart', { adapterConfig: { vmServiceUri: 'ws://127.0.0.1:8181/abc=/ws' } }, PORT_URI))
      .toEqual({ ok: true, locality: 'loopback', declared: true });
    expect(classifyAttachAddressing('javascript', {}, PID_PORT_URI)).toEqual({ ok: true, locality: 'unknown', declared: true });
  });

  it('skips the gate, declared false, when the factory declares no attachBy', () => {
    expect(classifyAttachAddressing('x', { processId: 1 }, UNDECLARED)).toEqual({ ok: true, locality: 'pid', declared: false });
    expect(classifyAttachAddressing('x', { port: 1 }, undefined)).toEqual({ ok: true, locality: 'loopback', declared: false });
  });

  it('treats an empty-string processId as absent', () => {
    expect(classifyAttachAddressing('java', { processId: '', port: 5005 }, PORT_ONLY)).toEqual({ ok: true, locality: 'loopback', declared: true });
  });
});

describe('attachLocalityOf', () => {
  it('reads a PID as this host, a port by its host, a URI by its hostname', () => {
    expect(attachLocalityOf({ processId: 7 })).toBe('pid');
    expect(attachLocalityOf({ processId: 7, host: '10.0.0.5', port: 9229 })).toBe('pid');
    expect(attachLocalityOf({ port: 5678 })).toBe('loopback');
    expect(attachLocalityOf({ port: 5678, host: '[::1]' })).toBe('loopback');
    expect(attachLocalityOf({ port: 5678, host: 'debug-pod' })).toBe('remote');
    expect(attachLocalityOf({ adapterConfig: { vmServiceUri: 'ws://127.0.0.1:8181/tok=/ws' } })).toBe('loopback');
    expect(attachLocalityOf({ adapterConfig: { websocketAddress: 'ws://10.1.2.3:9229/uuid' } })).toBe('remote');
    expect(attachLocalityOf({ adapterConfig: { vmServiceUri: 'not a uri' } })).toBe('unknown');
    expect(attachLocalityOf({ adapterConfig: { vmServiceInfoFile: '/tmp/info.json' } })).toBe('unknown');
    expect(attachLocalityOf({})).toBe('unknown');
  });
});
