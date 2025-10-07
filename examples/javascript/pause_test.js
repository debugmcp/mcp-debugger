function compute(a, b) {
  const sum = a + b;
  const product = a * b; // breakpoint here
  const ratio = b !== 0 ? a / b : null;
  return { sum, product, ratio, a, b };
}

const input = { x: 6, y: 7 };
const result = compute(input.x, input.y);
console.log('result', result);

let counter = 0;
for (let i = 0; i < 3; i++) {
  counter += i;
}
const message = `final ${counter}`;
console.log(message);
