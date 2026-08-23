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
  toolchainComponent,
  type AdapterDependencies,
  type AdapterMetadata,
  type FactoryValidationResult,
  type ToolchainDescription
} from '@debugmcp/shared';
import { JavascriptDebugAdapter } from './javascript-debug-adapter.js';
import { resolveJsDebugServer } from './utils/js-debug-resolver.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * The details shape validate() emits and describeToolchain() reads — keeping
 * producer and consumer on one alias makes key renames compiler-checked
 * within this package (issue #435).
 */
type JavascriptToolchainDetails = {
  nodeVersion: string;
  vendorPathChecked: string | null;
  tsxFound: boolean;
  tsNodeFound: boolean;
};

const metadata: AdapterMetadata = {
  language: 'javascript',
  displayName: 'JavaScript/TypeScript',
  version: '1.0.0',
  author: 'debugmcp',
  description: 'Debug JavaScript and TypeScript applications using Node.js',
  minimumDebuggerVersion: '2.0.0',
  fileExtensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts'],
  // Attach spawns the bundled js-debug adapter locally (needs Node, which the server itself runs on)
  modes: { launch: true, attach: 'spawn' },
  // Placeholder icon (base64-encoded empty SVG)
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
   *
   * @param nodeVersion Node version override for tests (issue #186); defaults to process.version
   */
  async validate(nodeVersion: string = process.version): Promise<FactoryValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Node.js version check (nodeVersion e.g. v20.11.1)
    let major = 0;
    const m = /^v?(\d+)\./.exec(nodeVersion);
    if (m) {
      major = parseInt(m[1], 10);
    }
    if (!Number.isFinite(major) || major < 14) {
      errors.push(`Node.js 14+ required. Current: ${nodeVersion}`);
    }

    // Resolve the vendored js-debug entry point across all deployment layouts
    // (package dist, bundled npx CLI, container) — issue #354/#364: probing a
    // single layout here made list_supported_languages report javascript as
    // unavailable on the npx bundle even though the payload was present.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const vendorPath = resolveJsDebugServer((p) => fs.existsSync(p), __dirname);
    if (vendorPath === null) {
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

    const details: JavascriptToolchainDetails = {
      nodeVersion,
      vendorPathChecked: vendorPath,
      tsxFound,
      tsNodeFound
    };
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details
    };
  }

  /**
   * Doctor row (issue #435): rendered entirely from validate() details. The
   * js-debug cell only renders when the vendored payload was actually found —
   * a hardcoded 'vendored' badge used to show even when validate() errored
   * "js-debug adapter not found".
   */
  async describeToolchain(validation: FactoryValidationResult): Promise<ToolchainDescription> {
    const details = (validation.details ?? {}) as Partial<JavascriptToolchainDetails>;
    return {
      runtime: toolchainComponent({ label: 'Node.js', version: details.nodeVersion }),
      backend: toolchainComponent({
        label: 'js-debug',
        // vendorPathChecked is a resolved path or null — truthiness is the
        // detection; toolchainComponent re-applies the non-empty-string rule.
        source: details.vendorPathChecked ? 'vendored' : undefined
      })
    };
  }

  /**
   * Create a new JavaScript debug adapter instance
   */
  createAdapter(dependencies: AdapterDependencies): IDebugAdapter {
    return new JavascriptDebugAdapter(dependencies);
  }
}
