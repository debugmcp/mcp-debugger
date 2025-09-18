import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDebugSession, startDebugging, closeDebugSession, getDebugServer } from '../../../test-utils/helpers/session-helpers';
import { getLogger } from '../../../../src/utils/logger';
import { DebugLanguage } from '@debugmcp/shared';
import path from 'path';
import { fileURLToPath } from 'url';

const logger = getLogger();

describe('Python Discovery - Success Scenarios', () => {
  let sessionId: string | undefined;
  const scriptPath = path.resolve(fileURLToPath(import.meta.url), '../../../../../examples/python/fibonacci.py');

  beforeAll(async () => {
    // Ensure the logger is configured for tests if needed
    logger.info('[Test Setup] Running Python Discovery Success Test');
    
    // Ensure we're using the compiled version by setting the working directory
    const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../../../');
    
    // Debug server is now lazy-initialized when needed
  });

  afterAll(async () => {
    if (sessionId) {
      await closeDebugSession(sessionId);
      sessionId = undefined;
    }
    // Debug server cleanup is handled by vitest.setup.ts
  });

  it('should find Python on Windows/Linux without explicit path and start debugging successfully', async () => {
    // This test runs in the standard Vitest environment, which should have Python in PATH
    // DO NOT mock Python discovery
    // DO NOT set PYTHON_PATH or PYTHON_EXECUTABLE
    // Test the REAL discovery logic
    
    logger.info(`[Test] Attempting to create debug session for script: ${scriptPath}`);
    const session = await createDebugSession({ language: DebugLanguage.PYTHON, name: 'PythonSuccessTest' });
    sessionId = session.id;
    
    logger.info(`[Test] Starting debugging for session: ${sessionId}`);
    const result = await startDebugging(sessionId, scriptPath);
    
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    logger.info(`[Test] Debugging started successfully for session: ${sessionId}`);
  }, 30000); // Increase timeout for potential slow Python startup
});
