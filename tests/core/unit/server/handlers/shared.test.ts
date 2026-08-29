/**
 * Helpers shared by more than one tool handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Variable } from '@debugmcp/shared';
import {
  readLineContext,
  redactionSummary,
  variablePayloadExtras,
  attachWarning
} from '../../../../../src/server/handlers/shared.js';
import { createMockToolContext } from '../server-test-helpers.js';

function variable(name: string, overrides: Partial<Variable> = {}): Variable {
  return { name, value: '1', type: 'int', expandable: false, ...overrides };
}

describe('variablePayloadExtras', () => {
  it('returns nothing when there is no filter, no redaction and no truncation', () => {
    expect(variablePayloadExtras([variable('x')], undefined, undefined)).toEqual({});
  });

  it('emits notFound: [] for a filter that matched everything', () => {
    const extras = variablePayloadExtras([variable('x')], ['x'], undefined);

    expect(extras.notFound).toEqual([]);
    expect('notFound' in extras).toBe(true);
  });

  it('emits notFound: [] for an EMPTY filter — [] is truthy, so the key must still appear', () => {
    const extras = variablePayloadExtras([variable('x')], [], undefined);

    expect('notFound' in extras).toBe(true);
    expect(extras.notFound).toEqual([]);
  });
  it('lists only the names that were not returned', () => {
    const extras = variablePayloadExtras([variable('x')], ['x', 'missing'], undefined);
    expect(extras.notFound).toEqual(['missing']);
  });

  it('keys notFound, redaction and truncation in that order', () => {
    const extras = variablePayloadExtras(
      [variable('secret', { redacted: true })],
      ['secret', 'gone'],
      { omittedCount: 2, valueTruncatedCount: 1 }
    );

    expect(Object.keys(extras)).toEqual(['notFound', 'redaction', 'truncation']);
    expect(extras.redaction?.masked).toBe(1);
    expect(extras.truncation?.omittedCount).toBe(2);
    expect(typeof extras.truncation?.notice).toBe('string');
    expect(extras.truncation?.notice.length).toBeGreaterThan(0);
  });
});

describe('redactionSummary', () => {
  it('is absent when nothing was masked', () => {
    expect(redactionSummary([{ redacted: false }, {}])).toBeUndefined();
  });

  it('counts the masked entries', () => {
    expect(redactionSummary([{ redacted: true }, {}, { redacted: true }])?.masked).toBe(2);
  });
});

describe('attachWarning', () => {
  it('reports the data warning of a successful attach', () => {
    expect(attachWarning({ success: true, data: { warning: 'dropped foo' } })).toBe('dropped foo');
  });

  it('stays silent on failure, and when there is no data or no warning', () => {
    expect(attachWarning({ success: false, data: { warning: 'dropped foo' } })).toBeUndefined();
    expect(attachWarning({ success: true })).toBeUndefined();
    expect(attachWarning({ success: true, data: {} })).toBeUndefined();
  });
});

describe('readLineContext', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = createMockToolContext();
  });

  it('returns the line content and its surroundings', async () => {
    const getLineContext = vi.fn().mockResolvedValue({
      lineContent: 'x = 1',
      surrounding: [{ line: 1, content: 'x = 1' }],
      extraFieldTheHandlerIgnores: true
    });
    ctx.lineReader = { getLineContext };

    const context = await readLineContext(ctx, '/app/main.py', 1, 'breakpoint');

    expect(getLineContext).toHaveBeenCalledWith('/app/main.py', 1, { contextLines: 2 });
    expect(context).toEqual({ lineContent: 'x = 1', surrounding: [{ line: 1, content: 'x = 1' }] });
  });

  it('reports no context when the reader returns nothing', async () => {
    ctx.lineReader = { getLineContext: vi.fn().mockResolvedValue(null) };

    expect(await readLineContext(ctx, '/app/main.py', 1, 'breakpoint')).toBeUndefined();
    expect(ctx.logger.debug).not.toHaveBeenCalled();
  });

  it('swallows a reader failure and logs it under the caller label', async () => {
    const failure = new Error('unreadable');
    ctx.lineReader = { getLineContext: vi.fn().mockRejectedValue(failure) };

    expect(await readLineContext(ctx, '/app/main.py', 7, 'step result')).toBeUndefined();
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      'Could not get line context for step result',
      { file: '/app/main.py', line: 7, error: failure }
    );
  });
});
