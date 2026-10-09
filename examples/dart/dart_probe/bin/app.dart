import 'dart:io';
import 'dart:async';
import 'dart:isolate';

class Counter {
  int value = 0;
  final List<String> history = [];
  void add(int n) {
    value += n;
    history.add('add $n');
  }
}

Future<int> slowDouble(int x) async {
  await Future<void>.delayed(const Duration(milliseconds: 20));
  final doubled = x * 2; // BP-ASYNC (line 16)
  return doubled;
}

void isolateBody(SendPort port) {
  final squares = [for (var i = 1; i <= 3; i++) i * i];
  port.send(squares); // BP-ISOLATE (line 22)
}

Future<void> main(List<String> args) async {
  final counter = Counter();
  final base = 40;
  counter.add(base);
  final answer = counter.value + 2; // BP-MAIN (line 29)
  print('answer=$answer');
  final doubled = await slowDouble(answer); // step_over across await
  print('doubled=$doubled'); // BP-AFTER-AWAIT (line 32)
  final rp = ReceivePort();
  await Isolate.spawn(isolateBody, rp.sendPort);
  final fromIsolate = await rp.first as List<int>;
  print('squares=$fromIsolate'); // BP-AFTER-ISOLATE (line 36)
  stderr.writeln('to-stderr');
  stdout.write('last line without newline');
}
