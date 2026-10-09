import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_probe/main.dart';

void main() {
  testWidgets('increments', (tester) async {
    await tester.pumpWidget(const ProbeApp());
    final before = find.text('count: 0'); // BP-WIDGET
    expect(before, findsOneWidget);
    await tester.tap(find.byKey(const Key('increment')));
    await tester.pumpAndSettle();
    expect(find.text('count: 1'), findsOneWidget);
  });

  testWidgets('second test', (tester) async {
    await tester.pumpWidget(const ProbeApp());
    expect(find.byKey(const Key('increment')), findsOneWidget);
  });
}
