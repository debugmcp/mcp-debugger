int divide(int a, int b) {
  if (b == 0) throw ArgumentError('b must not be zero');
  return a ~/ b;
}

void main() {
  try {
    divide(1, 0); // caught
  } catch (_) {
    print('caught once');
  }
  print(divide(2, 0)); // uncaught
}
