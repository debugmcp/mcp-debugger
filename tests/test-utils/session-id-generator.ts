/**
 * Test utility to generate unique session IDs for each test
 * This helps identify which test is leaking promises or resources
 */

/**
 * Generate a unique session ID for a test
 * @param testName The name of the current test
 * @returns A unique session ID that includes the test name
 */
export function getTestSessionId(testName?: string): string {
  if (!testName) {
    // Fallback if test name not provided
    return `session-unknown-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  // Clean test name for use in session ID
  // Remove special characters and limit length
  const cleanName = testName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, '') // Remove leading/trailing dashes
    .substring(0, 30);

  // Add timestamp and random suffix for uniqueness
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 5);

  return `session-${cleanName}-${timestamp}-${random}`;
}

/**
 * Extract test name from session ID for debugging
 * @param sessionId The session ID to parse
 * @returns The test name portion or null if not a test session ID
 */
export function getTestNameFromSessionId(sessionId: string): string | null {
  const match = sessionId.match(/^session-([^-]+(?:-[^-]+)*)-\d+-[a-z0-9]+$/);
  if (match) {
    return match[1].replace(/-/g, ' ');
  }
  return null;
}