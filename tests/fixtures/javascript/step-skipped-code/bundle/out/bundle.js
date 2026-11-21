var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/blib/index.js
var require_blib = __commonJS({
  "node_modules/blib/index.js"(exports2, module2) {
    "use strict";
    function libWork2(n) {
      let t = n;
      t += 1;
      return t;
    }
    function libCall2(fn) {
      return fn(2);
    }
    module2.exports = { libWork: libWork2, libCall: libCall2 };
  }
});

// src/app.js
var { libWork, libCall } = require_blib();
function mine(v) {
  const w = v * 3;
  return w;
}
function run() {
  const a = libWork(1);
  const b = a + 1;
  const c = mine(b);
  const d = c + 1;
  const e = libCall(mine);
  const f = e + 1;
  return f;
}
var out = run();
console.log("bundle done", out);
//# sourceMappingURL=bundle.js.map
