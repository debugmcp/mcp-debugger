import 'package:flutter/material.dart';

void main() {
  final probe = 'flutter_probe'; // BP-FMAIN
  debugPrint('starting $probe');
  runApp(const ProbeApp());
}

class ProbeApp extends StatefulWidget {
  const ProbeApp({super.key});

  @override
  State<ProbeApp> createState() => _ProbeAppState();
}

class _ProbeAppState extends State<ProbeApp> {
  int counter = 0;
  final List<int> history = [];

  void increment() {
    setState(() {
      counter += 1; // BP-INCREMENT
      history.add(counter);
      debugPrint('counter=$counter');
    });
  }

  @override
  Widget build(BuildContext context) {
    final label = 'count: $counter'; // BP-BUILD
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('probe')),
        body: Center(
          child: Text(label, key: const Key('count')),
        ),
        floatingActionButton: FloatingActionButton(
          key: const Key('increment'),
          onPressed: increment,
          child: const Icon(Icons.add),
        ),
      ),
    );
  }
}
