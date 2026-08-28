/** Serialize backend lifecycle mutations without letting one failure poison the queue. */
export class LifecycleQueue {
  constructor() {
    this.tail = Promise.resolve();
  }

  /** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
  run(operation) {
    const result = this.tail.then(operation, operation);
    this.tail = result.catch(() => {});
    return result;
  }
}
