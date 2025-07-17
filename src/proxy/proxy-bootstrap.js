/* eslint-disable no-console */
// This file runs in the proxy process before TypeScript types are available.
// console.error is used intentionally for debugging proxy startup.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bootstrapLogPrefix = `[Bootstrap ${new Date().toISOString()}]`;

// Simple logging function - just use stderr
function logBootstrapActivity(message) {
  console.error(`${bootstrapLogPrefix} ${message}`);
}

logBootstrapActivity(`Bootstrap script started. CWD: ${process.cwd()}`);

(async () => {
  try {
    // Set environment variable to explicitly signal proxy mode
    process.env.DAP_PROXY_WORKER = 'true';
    logBootstrapActivity('Setting DAP_PROXY_WORKER environment variable to indicate proxy mode.');
    
    // Determine which proxy version to load
    const bundlePath = path.join(__dirname, 'proxy-bundle.cjs');
    const entryPath = path.join(__dirname, 'dap-proxy-entry.js');
    
    // Check if bundle exists and decide which version to use
    const useBundle = (
      process.env.NODE_ENV === 'production' || 
      process.env.MCP_CONTAINER === 'true' ||
      fs.existsSync(bundlePath)
    );
    
    const proxyPath = useBundle ? bundlePath : entryPath;
    logBootstrapActivity(`Using ${useBundle ? 'bundled' : 'unbundled'} proxy from: ${proxyPath}`);
    
    // Verify the chosen file exists
    if (!fs.existsSync(proxyPath)) {
      logBootstrapActivity(`ERROR: Proxy file not found at ${proxyPath}`);
      if (useBundle) {
        logBootstrapActivity('Bundle was expected but not found. Build may have failed.');
      }
      process.exit(1);
    }
    
    // Convert to file URL for ESM import
    // On Windows: file:///C:/path/to/file
    // On Unix: file:///path/to/file
    const normalizedPath = proxyPath.replace(/\\/g, '/');
    const proxyUrl = normalizedPath.startsWith('/') 
      ? `file://${normalizedPath}`  // Unix path already has leading slash
      : `file:///${normalizedPath}`; // Windows path needs three slashes
    logBootstrapActivity(`Importing proxy from URL: ${proxyUrl}`);
    
    try {
      await import(proxyUrl);
      logBootstrapActivity(`Dynamic import of ${useBundle ? 'bundled' : 'unbundled'} proxy succeeded.`);
    } catch (importError) {
      const errorMessage = importError instanceof Error ? `${importError.name}: ${importError.message}\n${importError.stack}` : String(importError);
      logBootstrapActivity(`ERROR during dynamic import of proxy: ${errorMessage}`);
      throw importError;
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e);
    logBootstrapActivity(`ERROR during proxy bootstrap: ${errorMessage}`);
    process.exit(1); 
  }
})();
