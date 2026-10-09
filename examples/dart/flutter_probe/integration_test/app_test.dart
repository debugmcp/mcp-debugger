import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_probe/main.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('device increment', (tester) async {
    await tester.pumpWidget(const ProbeApp());
    final initial = find.text('count: 0'); // BP-INTEGRATION
    expect(initial, findsOneWidget);
    await tester.tap(find.byKey(const Key('increment')));
    await tester.pumpAndSettle();
    expect(find.text('count: 1'), findsOneWidget);
  });
}
