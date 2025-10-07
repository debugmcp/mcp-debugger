// TypeScript fixture for E2E debugging (TS + source maps)
const greeting: string = 'hello world';
const shout = greeting.toUpperCase(); // BREAK_HERE
console.log(shout);
