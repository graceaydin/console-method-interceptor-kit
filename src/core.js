const DEFAULT_CAPACITY = 100;

/**
 * A fixed-size circular buffer that keeps the most recent entries.
 *
 * We implement this ourselves rather than using an array with shift() because
 * shift() is O(n) and we want O(1) writes and reads. The buffer is intentionally
 * simple: it stores whatever values are passed to push and returns them in
 * insertion order via toArray().
 */
export class RingBuffer {
  /**
   * @param {number} capacity Maximum number of entries to retain.
   */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new TypeError('capacity must be a positive integer');
    }
    this._capacity = capacity;
    this._buffer = new Array(capacity);
    this._start = 0;
    this._size = 0;
  }

  /**
   * Append an entry. If the buffer is full, the oldest entry is overwritten.
   * @param {*} value
   */
  push(value) {
    const index = (this._start + this._size) % this._capacity;
    this._buffer[index] = value;
    if (this._size < this._capacity) {
      this._size += 1;
    } else {
      this._start = (this._start + 1) % this._capacity;
    }
  }

  /**
   * Return the entries in insertion order, oldest first.
   * @returns {Array}
   */
  toArray() {
    const result = new Array(this._size);
    for (let i = 0; i < this._size; i++) {
      result[i] = this._buffer[(this._start + i) % this._capacity];
    }
    return result;
  }

  /**
   * Remove all entries.
   */
  clear() {
    this._buffer = new Array(this._capacity);
    this._start = 0;
    this._size = 0;
  }

  /** @returns {number} Current number of stored entries. */
  get size() {
    return this._size;
  }

  /** @returns {number} Maximum number of entries the buffer can hold. */
  get capacity() {
    return this._capacity;
  }
}

/**
 * Wraps console methods so that every call is forwarded to the original method
 * and also captured in a ring buffer.
 *
 * Only the methods listed in `methods` are wrapped. Each wrapped method is
 * replaced on the console object. Call `restore()` to put the originals back.
 */
export class ConsoleInterceptor {
  /**
   * @param {object} [options]
   * @param {Console} [options.console] The console object to intercept. Defaults to globalThis.console.
   * @param {number} [options.capacity] Ring buffer capacity. Defaults to 100.
   * @param {string[]} [options.methods] Console method names to intercept.
   *   Defaults to ['log', 'info', 'warn', 'error', 'debug'].
   */
  constructor(options = {}) {
    const consoleObj = options.console ?? globalThis.console;
    if (!consoleObj || typeof consoleObj !== 'object') {
      throw new TypeError('a console object is required');
    }

    const capacity = options.capacity ?? DEFAULT_CAPACITY;
    const methods = options.methods ?? ['log', 'info', 'warn', 'error', 'debug'];

    if (!Array.isArray(methods) || methods.length === 0) {
      throw new TypeError('methods must be a non-empty array');
    }

    this._console = consoleObj;
    this._buffer = new RingBuffer(capacity);
    this._originals = new Map();
    this._wrapped = false;
    this._methods = methods.slice();
  }

  /**
   * Replace console methods with capturing wrappers.
   * Calling start() twice is a no-op.
   */
  start() {
    if (this._wrapped) {
      return;
    }
    for (const method of this._methods) {
      const original = this._console[method];
      if (typeof original !== 'function') {
        continue;
      }
      this._originals.set(method, original);
      const self = this;
      this._console[method] = function (...args) {
        // Forward first so the original behavior (including formatting) is preserved.
        original.apply(this, args);
        self._buffer.push({ method, args });
      };
    }
    this._wrapped = true;
  }

  /**
   * Restore the original console methods.
   * Calling restore() when not wrapped is a no-op.
   */
  restore() {
    if (!this._wrapped) {
      return;
    }
    for (const [method, original] of this._originals) {
      this._console[method] = original;
    }
    this._originals.clear();
    this._wrapped = false;
  }

  /**
   * @returns {Array<{method: string, args: Array}>} Captured calls in insertion order.
   */
  getEntries() {
    return this._buffer.toArray();
  }

  /**
   * Remove all captured entries without touching the console methods.
   */
  clear() {
    this._buffer.clear();
  }

  /** @returns {number} Number of captured entries. */
  get size() {
    return this._buffer.size;
  }

  /** @returns {number} Ring buffer capacity. */
  get capacity() {
    return this._buffer.capacity;
  }
}
