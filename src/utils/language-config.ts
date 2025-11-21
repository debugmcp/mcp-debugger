/**
 * Helpers for enabling/disabling language adapters based on environment flags.
 */

const DISABLE_ENV_KEY = 'DEBUG_MCP_DISABLE_LANGUAGES';

/**
 * Parse the disable list environment variable into a normalized set.
 */
export function getDisabledLanguages(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  const raw = env[DISABLE_ENV_KEY];
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length > 0),
  );
}

/**
 * Returns true when the provided language is disabled via env configuration.
 */
export function isLanguageDisabled(
  language: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!language) {
    return false;
  }
  const disabled = getDisabledLanguages(env);
  return disabled.has(language.toLowerCase());
}
