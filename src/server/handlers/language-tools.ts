/**
 * Language tool: list_supported_languages.
 */
import { ErrorCode as McpErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getDisabledLanguages } from '../../utils/language-config.js';
import { probeLanguageEntry, LanguageModes } from '../../utils/language-availability.js';
import type { ToolContext, ToolHandler } from '../tool-context.js';
import { jsonResult, type ToolResult } from '../tool-result.js';

/**
 * Entry in the list_supported_languages 'available' array.
 * 'installed' keeps its historical meaning (adapter package loadable);
 * 'modes' carries per-mode availability with reasons (issue #331).
 */
export interface AvailableLanguage {
  language: string;
  package: string;
  installed: boolean;
  description?: string;
  modes: LanguageModes;
}

export async function handleListSupportedLanguages(ctx: ToolContext): Promise<ToolResult> {
  try {
    const adapterRegistry = ctx.getAdapterRegistry();
    // Get installed languages via dynamic registry if available
    const installed = await ctx.getSupportedLanguagesAsync();

    // Also surface known adapters with install status if available from registry
    let baseEntries: Array<{ language: string; package: string; installed: boolean; description?: string; attach: 'none' | 'direct-connect' | 'spawn' }> =
      installed.map(lang => ({
        language: lang,
        package: `@debugmcp/adapter-${lang}`,
        installed: true,
        attach: 'none' as const
      }));

    // listAvailableAdapters/getFactory are on IAdapterRegistry (issue #435
    // part 4); the runtime guards stay for partial registry doubles.
    if (adapterRegistry && typeof adapterRegistry.listAvailableAdapters === 'function') {
      try {
        const meta = await adapterRegistry.listAvailableAdapters();
        baseEntries = meta.map(m => ({
          language: m.name,
          package: m.packageName,
          installed: m.installed,
          description: m.description,
          attach: m.attach ?? 'none'
        }));
      } catch (e) {
        ctx.logger.warn('Failed to query detailed adapter metadata; returning installed list only', { error: (e as Error)?.message });
      }
    }

    // Shared per-entry probe (issue #435): doctor consumes the same
    // function, so the two views cannot drift apart. Probes run in
    // parallel — on a cold cache each may import an adapter package and
    // spawn a toolchain check, and this call should pay the max, not the
    // sum (the doctor path already runs them concurrently).
    const disabledSet = getDisabledLanguages();
    const available: AvailableLanguage[] = await Promise.all(
      baseEntries.map(async (entry) => {
        const probe = await probeLanguageEntry(
          {
            language: entry.language,
            packageName: entry.package,
            installed: entry.installed,
            attach: entry.attach
          },
          {
            registry: adapterRegistry,
            disabledSet,
            runValidate: (language, validate) => ctx.validationCache.get(language, validate),
            logger: ctx.logger
          }
        );
        return {
          language: entry.language,
          package: entry.package,
          installed: entry.installed,
          description: entry.description,
          modes: probe.modes
        };
      })
    );

    // Also build simple metadata array for backward compatibility with previous payload shape
    const languageMetadata = await ctx.getLanguageMetadata();

    return jsonResult({
      success: true,
      installed,
      available,
      languages: languageMetadata, // backward-compatible field with display info
      count: installed.length
    });
  } catch (error) {
    ctx.logger.error('Failed to list supported languages', { error });
    throw new McpError(McpErrorCode.InternalError, `Failed to list supported languages: ${(error as Error).message}`);
  }
}

export const listSupportedLanguagesTool: ToolHandler = async (ctx) => {
  return await handleListSupportedLanguages(ctx);
};
