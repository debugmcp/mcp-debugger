/**
 * Supported-language discovery for the MCP server: which languages the
 * adapter registry can serve (with the disabled-language filter and the
 * container-runtime python guarantee applied), and the display metadata
 * list_supported_languages reports for them.
 */
import { DebugLanguage, IAdapterRegistry, ILogger } from '@debugmcp/shared';
import { getDisabledLanguages } from '../utils/language-config.js';

export const DEFAULT_LANGUAGES = Object.freeze([DebugLanguage.PYTHON, DebugLanguage.MOCK] as const);

export function getDefaultLanguages(): string[] {
  return [...DEFAULT_LANGUAGES];
}

export function ensureLanguage(
  languages: readonly string[],
  language: string
): string[] {
  return languages.includes(language) ? [...languages] : [...languages, language];
}

export function filterDisabledLanguages(
  languages: readonly string[],
  disabled?: Set<string>,
): string[] {
  const disabledSet = disabled ?? getDisabledLanguages();
  if (!disabledSet.size) {
    return [...languages];
  }
  return languages.filter((lang) => !disabledSet.has(lang));
}

/**
 * Get supported languages from the adapter registry. Prefers dynamic
 * discovery, then already-registered factories, then the shipped defaults;
 * python is always advertised in the container runtime.
 */
export async function discoverSupportedLanguages(
  adapterRegistry: IAdapterRegistry | undefined,
  logger: ILogger
): Promise<string[]> {
  const disabled = getDisabledLanguages();
  const filter = (langs: readonly string[]) => filterDisabledLanguages(langs, disabled);
  // Guard against undefined registry in certain test environments
  if (!adapterRegistry) {
    return filter(getDefaultLanguages());
  }
  // Prefer dynamic discovery. listLanguages is on IAdapterRegistry (issue
  // #435 part 4); the runtime guard stays for partial registry doubles.
  const maybeList = adapterRegistry.listLanguages;
  if (typeof maybeList === 'function') {
    try {
      const langs = await maybeList.call(adapterRegistry);
      if (Array.isArray(langs) && langs.length > 0) {
        const normalized =
          process.env.MCP_CONTAINER === 'true' ? ensureLanguage(langs, DebugLanguage.PYTHON) : langs;
        return filter(normalized);
      }
    } catch (e) {
      logger.warn('Dynamic adapter language discovery failed, falling back to registered languages', { error: (e as Error)?.message });
    }
  }
  // Fallback to already-registered factories (may be empty until first use)
  const langs = adapterRegistry.getSupportedLanguages?.() || [];
  if (langs.length > 0) {
    // In container runtime, ensure python is advertised even if not yet registered (preload may be async)
    if (process.env.MCP_CONTAINER === 'true') {
      return filter(ensureLanguage(langs, DebugLanguage.PYTHON));
    }
    return filter(langs);
  }
  // Final fallback to known defaults for UX (ensure python listed in container)
  if (process.env.MCP_CONTAINER === 'true') {
    return filter(ensureLanguage(getDefaultLanguages(), DebugLanguage.PYTHON));
  }
  return filter(getDefaultLanguages());
}

/**
 * Language metadata for supported languages
 */
export interface LanguageMetadata {
  id: string;
  displayName: string;
  version: string;
  requiresExecutable: boolean;
  defaultExecutable?: string;
}

/** Get language metadata for all supported languages. */
export function buildLanguageMetadata(languages: string[]): LanguageMetadata[] {
  // Hardcoded metadata fallback; adapters could provide this via registry in the future
  return languages.map((lang: string) => {
    switch (lang) {
      case DebugLanguage.PYTHON:
        return {
          id: DebugLanguage.PYTHON,
          displayName: 'Python',
          version: '1.0.0',
          requiresExecutable: true,
          defaultExecutable: 'python'
        };
      case DebugLanguage.RUBY:
        return {
          id: DebugLanguage.RUBY,
          displayName: 'Ruby',
          version: '1.0.0',
          requiresExecutable: true,
          defaultExecutable: 'ruby'
        };
      case DebugLanguage.MOCK:
        return {
          id: DebugLanguage.MOCK,
          displayName: 'Mock',
          version: '1.0.0',
          requiresExecutable: false
        };
      case DebugLanguage.JAVASCRIPT:
        return {
          id: DebugLanguage.JAVASCRIPT,
          displayName: 'JavaScript/TypeScript',
          version: '1.0.0',
          requiresExecutable: true,
          defaultExecutable: 'node'
        };
      case DebugLanguage.CPP:
        return {
          id: DebugLanguage.CPP,
          displayName: 'C/C++',
          version: '1.0.0',
          requiresExecutable: true,
          defaultExecutable: 'g++'
        };
      default:
        return {
          id: lang,
          displayName: lang.charAt(0).toUpperCase() + lang.slice(1),
          version: '1.0.0',
          requiresExecutable: true
        };
    }
  });
}
