#!/usr/bin/env node
/**
 * Validation script that tests the repository in a clean clone
 * This simulates what CI will see and catches issues like missing files
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, cwd = process.cwd()) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe' 
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

function execWithOutput(command, cwd = process.cwd()) {
  try {
    execSync(command, { 
      cwd, 
      stdio: 'inherit' 
    });
  } catch (error) {
    throw new Error(`Command failed: ${command}`);
  }
}

async function validatePush(options = {}) {
  const startTime = Date.now();
  const originalCwd = process.cwd();
  const tempDir = path.join(os.tmpdir(), `mcp-debugger-validate-${Date.now()}`);
  
  // Default options
  const config = {
    runTests: options.runTests !== false,  // Default true
    runSmoke: options.runSmoke || false,   // Default false (faster)
    verbose: options.verbose || false,
    keepTemp: options.keepTemp || false
  };

  log('\n📋 MCP Debugger Push Validation\n', colors.cyan);
  log('This simulates what CI will see by testing in a clean clone.\n');
  
  try {
    // 1. Get current branch and commit info
    log('1️⃣  Getting current repository state...', colors.blue);
    const branch = exec('git rev-parse --abbrev-ref HEAD').trim();
    const commit = exec('git rev-parse HEAD').trim();
    const hasUncommitted = exec('git status --porcelain').trim();
    
    log(`   Branch: ${branch}`);
    log(`   Commit: ${commit.substring(0, 8)}`);
    
    if (hasUncommitted) {
      log('\n⚠️  Warning: You have uncommitted changes!', colors.yellow);
      log('   These changes will NOT be included in the validation.', colors.yellow);
      log('   (This simulates what CI will see)\n', colors.yellow);
      
      // Show what's not committed
      const uncommittedFiles = hasUncommitted.split('\n').slice(0, 5);
      uncommittedFiles.forEach(file => log(`   ${file}`, colors.yellow));
      if (hasUncommitted.split('\n').length > 5) {
        log(`   ... and ${hasUncommitted.split('\n').length - 5} more files`, colors.yellow);
      }
    }

    // 2. Create temp directory
    log('\n2️⃣  Creating temporary directory...', colors.blue);
    await fs.ensureDir(tempDir);
    log(`   ${tempDir}`);

    // 3. Clone the repository (what CI would see)
    log('\n3️⃣  Cloning repository (simulating CI environment)...', colors.blue);
    const cloneCmd = `git clone --no-local "${originalCwd}" .`;
    
    if (config.verbose) {
      execWithOutput(cloneCmd, tempDir);
    } else {
      exec(cloneCmd, tempDir);
      log('   ✓ Repository cloned');
    }

    // Change to the temp directory for remaining operations
    process.chdir(tempDir);

    // 4. Checkout the specific commit
    log('\n4️⃣  Checking out commit...', colors.blue);
    exec(`git checkout ${commit}`);
    log(`   ✓ Checked out ${commit.substring(0, 8)}`);

    // 5. Install dependencies
    log('\n5️⃣  Installing dependencies (pnpm install)...', colors.blue);
    if (config.verbose) {
      execWithOutput('pnpm install', tempDir);
    } else {
      exec('pnpm install', tempDir);
      log('   ✓ Dependencies installed');
    }

    // 6. Build the project
    log('\n6️⃣  Building project (pnpm build)...', colors.blue);
    if (config.verbose) {
      execWithOutput('pnpm build', tempDir);
    } else {
      exec('pnpm build', tempDir);
      log('   ✓ Build successful');
    }

    // 7. Run tests
    if (config.runTests) {
      if (config.runSmoke) {
        log('\n7️⃣  Running smoke tests (quick validation)...', colors.blue);
        // Run a subset of tests for speed
        const testCmd = 'pnpm test -- tests/unit/index.test.ts tests/core/unit/server/server.test.ts';
        if (config.verbose) {
          execWithOutput(testCmd, tempDir);
        } else {
          exec(testCmd, tempDir);
          log('   ✓ Smoke tests passed');
        }
      } else {
        log('\n7️⃣  Running full test suite (this may take a while)...', colors.blue);
        if (config.verbose) {
          execWithOutput('pnpm test', tempDir);
        } else {
          // For full tests, show some progress
          log('   Running tests...');
          exec('pnpm test', tempDir);
          log('   ✓ All tests passed');
        }
      }
    } else {
      log('\n7️⃣  Skipping tests (--no-tests flag)', colors.yellow);
    }

    // Success!
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('\n✅ Validation passed! Your code is ready to push.', colors.green);
    log(`   Completed in ${duration} seconds\n`, colors.green);
    
    return true;

  } catch (error) {
    // Validation failed
    log('\n❌ Validation failed!', colors.red);
    log('   This would have failed in CI.\n', colors.red);
    
    log('Error details:', colors.red);
    console.error(error.message);
    
    log('\nCommon causes:', colors.yellow);
    log('  • Files exist locally but are not committed (check git status)');
    log('  • Build artifacts committed that shouldn\'t be');
    log('  • Dependencies out of sync with package-lock');
    log('  • Tests that only pass with local state\n');
    
    if (!config.keepTemp) {
      log(`Temp directory will be cleaned up: ${tempDir}`, colors.cyan);
      log('Use --keep-temp to preserve it for debugging\n', colors.cyan);
    }
    
    return false;

  } finally {
    // Restore original directory
    process.chdir(originalCwd);
    
    // Cleanup temp directory (unless --keep-temp)
    if (!config.keepTemp && await fs.pathExists(tempDir)) {
      try {
        await fs.remove(tempDir);
      } catch (cleanupError) {
        log(`\nWarning: Could not clean up temp directory: ${tempDir}`, colors.yellow);
        log('You may need to delete it manually.', colors.yellow);
      }
    } else if (config.keepTemp) {
      log(`\nTemp directory preserved at: ${tempDir}`, colors.cyan);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options = {
    runTests: !args.includes('--no-tests'),
    runSmoke: args.includes('--smoke'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    keepTemp: args.includes('--keep-temp'),
    help: args.includes('--help') || args.includes('-h')
  };

  if (options.help) {
    console.log(`
MCP Debugger Push Validation Script

This script validates your changes by testing them in a clean clone,
simulating exactly what CI will see. It helps catch issues like:
- Files that exist locally but aren't committed
- Build artifacts that shouldn't be committed  
- Tests that only pass with local state

Usage:
  node scripts/validate-push.js [options]

Options:
  --no-tests    Skip running tests (faster, but less thorough)
  --smoke       Run only smoke tests instead of full suite (faster)
  --verbose     Show detailed output from commands
  --keep-temp   Don't delete the temp directory after validation
  --help        Show this help message

Examples:
  npm run validate         # Full validation (default)
  npm run validate:quick   # Build only, no tests
  npm run validate:smoke   # Build + smoke tests
`);
    process.exit(0);
  }

  try {
    const success = await validatePush(options);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { validatePush };
