import 'dart:async';
import 'dart:io';

int tick = 0;

Future<void> main() async {
  final pid = pid_();
  stdout.writeln('pause.dart pid=$pid');
  while (true) {
    tick += 1; // BP-TICK (line 10)
    if (tick % 50 == 0) stdout.writeln('tick=$tick');
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }
}

int pid_() => pid;
