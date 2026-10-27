/**
 * The one sentence every refusal of a Dart attach form points at (issues #903, #882): the factory's
 * `attachHints.processId` and the transform's own refusals quote it, so the remedies never diverge.
 */
export const DART_ATTACH_FORMS_HINT =
  'Dart attaches by VM-service URI: pass adapterConfig.vmServiceUri (from dart --enable-vm-service run, the app.debugPort event of '
  + 'flutter run --machine, or the dart.debuggerUris answer of this server) or adapterConfig.vmServiceInfoFile (the file written by '
  + '--write-service-info); a Flutter app on an Android device or emulator takes adapterConfig.deviceId alone (flutter attach discovers it)';
