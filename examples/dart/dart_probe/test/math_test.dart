import 'package:test/test.dart';

int add(int a, int b) => a + b;

void main() {
  test('adds numbers', () {
    final base = 40;
    final answer = add(base, 2); // BP-TEST (line 8)
    expect(answer, 42);
  });

  test('fails on purpose', () {
    expect(add(1, 1), 3);
  });
}
