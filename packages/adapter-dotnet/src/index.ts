/**
 * @debugmcp/adapter-dotnet public exports
 */

// Adapters
export { DotnetAdapterFactory } from './DotnetAdapterFactory.js';
export { DotnetDebugAdapter } from './DotnetDebugAdapter.js';

// Utils
export {
  findNetcoredbgExecutable,
  findDotnetBackend,
  getNetcoredbgVersion,
  getDotnetSdkVersion,
  listDotnetProcesses,
  isPortablePdb,
  findPdb2PdbExecutable,
  convertPdbsToTemp,
  getProcessExecutablePath,
  getProcessExecutableDir,
  getExeArchitecture,
  getProcessArchitecture,
  CommandNotFoundError
} from './utils/dotnet-utils.js';
