import 'dart:developer' as developer;
import 'dart:io';

Future<void> main() async {
  print('loading settings');
  developer.log('default-channel check');
  developer.log('settings file is missing a required key: db.url', name: 'config');
  await Future<void>.delayed(const Duration(milliseconds: 25));
  exitCode = 2;
}
