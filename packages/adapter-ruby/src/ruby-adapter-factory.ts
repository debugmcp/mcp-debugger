import { IDebugAdapter } from '@debugmcp/shared';
import {
  IAdapterFactory,
  AdapterDependencies,
  AdapterMetadata,
  FactoryValidationResult,
  ToolchainDescription
} from '@debugmcp/shared';
import { DebugLanguage, toolchainComponent } from '@debugmcp/shared';
import { RubyDebugAdapter } from './ruby-debug-adapter.js';
import {
  findRubyExecutable,
  getRubyVersion,
  findRdbgExecutable,
  getRdbgVersion
} from './utils/ruby-utils.js';

/**
 * The details shape validate() emits and describeToolchain() reads — keeping
 * producer and consumer on one alias makes key renames compiler-checked
 * within this package (issue #435).
 */
type RubyToolchainDetails = {
  rubyPath?: string;
  rubyVersion?: string;
  rdbgPath?: string;
  rdbgVersion?: string;
  platform: string;
  timestamp: string;
};

export class RubyAdapterFactory implements IAdapterFactory {
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new RubyDebugAdapter(dependencies);
  }

  getMetadata(): AdapterMetadata {
    return {
      language: DebugLanguage.RUBY,
      displayName: 'Ruby',
      version: '0.21.0',
      author: 'mcp-debugger team',
      description: 'Debug Ruby applications using rdbg',
      documentationUrl: 'https://github.com/debugmcp/mcp-debugger/tree/main/docs/ruby',
      minimumDebuggerVersion: '1.7.0',
      fileExtensions: ['.rb', '.rake', '.gemspec'],
      // Attach connects straight to a running rdbg --open DAP socket (no local Ruby needed)
      modes: { launch: true, attach: 'direct-connect' }
    };
  }

  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let rubyPath: string | undefined;
    let rubyVersion: string | undefined;
    let rdbgPath: string | undefined;
    let rdbgVersion: string | undefined;

    try {
      rubyPath = await findRubyExecutable();
      rubyVersion = await getRubyVersion(rubyPath) || undefined;

      if (rubyVersion) {
        const [major, minor] = rubyVersion.split('.').map(Number);
        if (major < 2 || (major === 2 && minor < 7)) {
          errors.push(`Ruby 2.7 or higher required. Current version: ${rubyVersion}`);
        }
      } else {
        warnings.push('Could not determine Ruby version');
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Ruby executable not found');
    }

    try {
      rdbgPath = await findRdbgExecutable();
      rdbgVersion = await getRdbgVersion(rdbgPath) || undefined;
      if (!rdbgVersion) {
        warnings.push('Could not determine rdbg version');
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'rdbg not found');
    }

    const details: RubyToolchainDetails = {
      rubyPath,
      rubyVersion,
      rdbgPath,
      rdbgVersion,
      platform: process.platform,
      timestamp: new Date().toISOString()
    };
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details
    };
  }

  /**
   * Doctor row (issue #435): rendered entirely from validate() details.
   */
  async describeToolchain(validation: FactoryValidationResult): Promise<ToolchainDescription> {
    const details = (validation.details ?? {}) as Partial<RubyToolchainDetails>;
    return {
      runtime: toolchainComponent({ label: 'Ruby', path: details.rubyPath, version: details.rubyVersion }),
      backend: toolchainComponent({ label: 'rdbg', path: details.rdbgPath, version: details.rdbgVersion })
    };
  }
}
