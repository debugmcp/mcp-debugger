/**
 * Helpers for building and consuming IAdapterFactory.describeToolchain rows
 * (issue #435). Adapters build cells with toolchainComponent(); the doctor CLI
 * defends against out-of-tree factories with normalizeToolchainDescription().
 */
import type { ToolchainComponent, ToolchainDescription } from '../interfaces/adapter-registry.js';

const FIELDS = ['path', 'version', 'source'] as const;

const asDetected = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Build one doctor cell. A cell is only rendered when something was actually
 * detected — a bare label would make an absent toolchain read as present.
 * `(built-in)` style labels stand alone by design (mock). Field values are
 * treated as detections only when they are non-empty strings, so adapters can
 * pass raw `details` values without per-field guards.
 */
export function toolchainComponent(info: {
  label: string;
  path?: unknown;
  version?: unknown;
  source?: unknown;
}): ToolchainComponent | undefined {
  const component: ToolchainComponent = { label: info.label };
  let detected = false;
  for (const field of FIELDS) {
    const value = asDetected(info[field]);
    if (value !== undefined) {
      component[field] = value;
      detected = true;
    }
  }
  if (info.label.startsWith('(')) {
    return component;
  }
  return detected ? component : undefined;
}

/**
 * Defensive normalization of a describeToolchain() return value: an
 * out-of-tree factory is plain JS, so anything can come back. Non-object
 * values yield empty cells; each cell must carry a non-empty string label and
 * is re-filtered through the toolchainComponent rules.
 */
export function normalizeToolchainDescription(value: unknown): ToolchainDescription {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const description: ToolchainDescription = {};
  for (const cell of ['runtime', 'backend'] as const) {
    const raw = (value as Record<string, unknown>)[cell];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      continue;
    }
    const candidate = raw as Record<string, unknown>;
    const label = asDetected(candidate.label);
    if (label === undefined) {
      continue;
    }
    const component = toolchainComponent({
      label,
      path: candidate.path,
      version: candidate.version,
      source: candidate.source
    });
    if (component) {
      description[cell] = component;
    }
  }
  return description;
}
