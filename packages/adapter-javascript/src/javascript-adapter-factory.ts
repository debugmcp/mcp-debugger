/**
 * JavaScript Adapter Factory
 *
 * Factory for creating JavaScript/TypeScript debug adapter instances.
 * Extends the shared AdapterFactory base to align with repository conventions.
 *
 * @since 0.1.0
 */
import type { IDebugAdapter } from '@debugmcp/shared';
import {
  AdapterFactory as BaseAdapterFactory,
  type AdapterDependencies,
  type AdapterMetadata,
  type FactoryValidationResult
} from '@debugmcp/shared';
import { JavascriptDebugAdapter } from './javascript-debug-adapter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const metadata: AdapterMetadata = {
  language: 'javascript',
  displayName: 'JavaScript/TypeScript',
  version: '1.0.0',
  author: 'debugmcp',
  description: 'Debug JavaScript and TypeScript applications using Node.js',
  minimumDebuggerVersion: '2.0.0',
  fileExtensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts'],
  // Placeholder icon (base64-encoded SVG). To be replaced in a later task if needed.
  icon: 'data:image/svg+xml;base64,PHN2Zy8+'
};

/**
 * Factory for creating JavaScript/TypeScript debug adapters
 */
export class JavascriptAdapterFactory extends BaseAdapterFactory {
  constructor() {
    super(metadata);
  }

  /**
   * Validate environment for JavaScript/TypeScript debugging
   * - Node.js version >= 14
   * - Bundled js-debug adapter present
   * - TypeScript runner availability (warnings only)
   */
  async validate(): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Node.js version check
    const nodeVersion = process.version; // e.g., v20.11.1
    let major = 0;
    const m = /^v?(\d+)\./.exec(nodeVersion);
    if (m) {
      major = parseInt(m[1], 10);
    }
    if (!Number.isFinite(major) || major < 14) {
      errors.push(`Node.js 14+ required. Current: ${nodeVersion}`);
    }

    // Resolve vendor js-debug vsDebugServer.js relative to compiled/dist location
    // Works for both src (unit tests) and dist (production) since vendor is sibling of both.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const vendorPath = path.resolve(__dirname, '../vendor/js-debug/vsDebugServer.js');

    // Bundled js-debug presence
    try {
      if (!fs.existsSync(vendorPath)) {
        errors.push('js-debug adapter not found. Run build script to vendor js-debug');
      }
    } catch {
      // If fs throws for any reason, treat as missing to be safe
      errors.push('js-debug adapter not found. Run build script to vendor js-debug');
    }

    // TypeScript runner detection (warnings only)
    const isWin = process.platform === 'win32';
    const exts = isWin ? ['.cmd', '.exe', ''] : [''];

    const existsSafe = (p: string) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    };

    const checkInDir = (dir: string, binName: string) => {
      for (const ext of exts) {
        const candidate = path.join(dir, binName + ext);
        if (existsSafe(candidate)) return true;
      }
      return false;
    };

    let tsxFound = false;
    let tsNodeFound = false;

    // Local node_modules/.bin check
    const localBin = path.resolve(process.cwd(), 'node_modules', '.bin');
    tsxFound = checkInDir(localBin, 'tsx') || tsxFound;
    tsNodeFound = checkInDir(localBin, 'ts-node') || tsNodeFound;

    // PATH lookup (short-circuit when both found)
    const pathEnv = process.env.PATH || '';
    const pathParts = pathEnv.split(path.delimiter).filter(Boolean);

    for (const dir of pathParts) {
      if (!tsxFound) tsxFound = checkInDir(dir, 'tsx');
      if (!tsNodeFound) tsNodeFound = checkInDir(dir, 'ts-node');
      if (tsxFound && tsNodeFound) break;
    }

    if (!tsxFound && !tsNodeFound) {
      warnings.push('No TypeScript runner found. Install tsx or ts-node for TS debugging');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        nodeVersion,
        vendorPathChecked: vendorPath,
        tsxFound,
        tsNodeFound
      }
    };
  }

  /**
   * Create a new JavaScript debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new JavascriptDebugAdapter(dependencies);
  }
}
