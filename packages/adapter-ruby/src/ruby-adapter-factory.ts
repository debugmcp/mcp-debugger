import { IDebugAdapter } from '@debugmcp/shared';
import {
  IAdapterFactory,
  AdapterDependencies,
  AdapterMetadata,
  FactoryValidationResult
} from '@debugmcp/shared';
import { DebugLanguage } from '@debugmcp/shared';
import { RubyDebugAdapter } from './ruby-debug-adapter.js';
import {
  findRubyExecutable,
  getRubyVersion,
  findRdbgExecutable,
  getRdbgVersion
} from './utils/ruby-utils.js';

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
      fileExtensions: ['.rb', '.rake', '.gemspec']
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

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        rubyPath,
        rubyVersion,
        rdbgPath,
        rdbgVersion,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
  }
}
