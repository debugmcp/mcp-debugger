import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDebugSession, startDebugging, closeDebugSession } from '../../../test-utils/helpers/session-helpers';
import path from 'path';
import { DebugLanguage } from '../../../../src/session/models';

describe('Python Discovery - Failure Scenario', () => {
  let sessionId: string | undefined;
  let originalPath: string | undefined;
  const scriptPath = path.join(process.cwd(), 'examples/python/fibonacci.py');

  beforeAll(async () => {
    // Save original PATH
    originalPath = process.env.PATH;
    // Start server with minimal PATH so python commands cannot be found
    process.env.PATH = 'C:\\Windows\\System32';
    // Debug server is now lazy-initialized when needed
  });

  afterAll(async () => {
    if (sessionId) {
      await closeDebugSession(sessionId);
      sessionId = undefined;
    }
    // Debug server cleanup is handled by vitest.setup.ts
    // Restore original PATH
    if (originalPath !== undefined) {
      process.env.PATH = originalPath;
    }
  });

  it('should error when Python is not found in PATH', async () => {
const session = await createDebugSession({ language: DebugLanguage.PYTHON, name: 'PythonFailureTest' });
    sessionId = session.id;

    const result = await startDebugging(sessionId, scriptPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Python not found');
  }, 30000);
});
