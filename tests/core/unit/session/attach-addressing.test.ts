/**
 * The attach-addressing verdict (issue #903): a request against a language's
 * declaration, before any session state changes.
 */
import { describe, it, expect } from 'vitest';
import type { AdapterModes } from '@debugmcp/shared';
import { attachLocalityOf, classifyAttachAddressing, namesAttachTarget } from '../../../../src/session/attach/attach-addressing.js';

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

  it('refuses a remote host beside a processId on every language, with the remedy the language has', () => {
    const cpp = classifyAttachAddressing('cpp', { processId: 1, host: '10.0.0.5' }, PID_ONLY);
    expect(cpp.ok).toBe(false);
    if (!cpp.ok) {
      expect(cpp.error).toMatch(/host 10\.0\.0\.5 is not loopback/);
      expect(cpp.error).toMatch(/attaches to a local PID only/);
    }
    // JavaScript accepts a port too, so the PID attach would otherwise pass this
    // gate and fail inside the adapter after the session changed state.
    const js = classifyAttachAddressing('javascript', { processId: 1, host: '10.0.0.5' }, PID_PORT_URI);
    expect(js.ok).toBe(false);
    if (!js.ok) {
      expect(js.error).toMatch(/host 10\.0\.0\.5 is not loopback/);
      expect(js.error).toMatch(/by host and port without processId/);
    }
    const loopback = classifyAttachAddressing('cpp', { processId: 1, host: 'localhost' }, PID_ONLY);
    expect(loopback).toEqual({ ok: true, locality: 'pid', declared: true });
  });

  it('refuses a remote host alone on a PID-only language', () => {
    const verdict = classifyAttachAddressing('cpp', { host: '10.0.0.5' }, PID_ONLY);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toMatch(/'cpp' does not attach by host/);
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

describe('namesAttachTarget (issue #905)', () => {
  it('is true for a port, a processId, or an adapterConfig URI / info-file key', () => {
    expect(namesAttachTarget({ port: 5678 })).toBe(true);
    expect(namesAttachTarget({ processId: 7 })).toBe(true);
    expect(namesAttachTarget({ processId: '7' })).toBe(true);
    expect(namesAttachTarget({ adapterConfig: { vmServiceUri: 'ws://127.0.0.1:8181/tok=/ws' } })).toBe(true);
    expect(namesAttachTarget({ adapterConfig: { websocketAddress: 'ws://127.0.0.1:9229/uuid' } })).toBe(true);
    expect(namesAttachTarget({ adapterConfig: { vmServiceInfoFile: '/tmp/vm.json' } })).toBe(true);
    // A Flutter device id alone: `flutter attach -d <id>` discovers the app (issue #882).
    expect(namesAttachTarget({ adapterConfig: { deviceId: 'emulator-5554' } })).toBe(true);
  });

  it('is false for a host alone, an empty processId, or an adapterConfig without a target key', () => {
    expect(namesAttachTarget({})).toBe(false);
    expect(namesAttachTarget({ host: '127.0.0.1' })).toBe(false);
    expect(namesAttachTarget({ processId: '' })).toBe(false);
    expect(namesAttachTarget({ adapterConfig: { pathMappings: [], vmServiceUri: '' } })).toBe(false);
    expect(namesAttachTarget({ adapterConfig: { deviceId: '' } })).toBe(false);
  });
});
