import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleInterceptor, RingBuffer } from '../src/index.js';

// A minimal fake console that records forwarded calls.
function makeFakeConsole() {
  const calls = [];
  const fake = {
    calls,
    log: (...args) => calls.push(['log', args]),
    info: (...args) => calls.push(['info', args]),
    warn: (...args) => calls.push(['warn', args]),
    error: (...args) => calls.push(['error', args]),
    debug: (...args) => calls.push(['debug', args]),
  };
  return fake;
}

test('RingBuffer stores entries in insertion order', () => {
  const rb = new RingBuffer(3);
  rb.push('a');
  rb.push('b');
  rb.push('c');
  assert.deepEqual(rb.toArray(), ['a', 'b', 'c']);
  assert.equal(rb.size, 3);
  assert.equal(rb.capacity, 3);
});

test('RingBuffer overwrites oldest when full', () => {
  const rb = new RingBuffer(2);
  rb.push(1);
  rb.push(2);
  rb.push(3);
  assert.deepEqual(rb.toArray(), [2, 3]);
  assert.equal(rb.size, 2);
});

test('RingBuffer clear resets to empty', () => {
  const rb = new RingBuffer(2);
  rb.push(1);
  rb.push(2);
  rb.clear();
  assert.deepEqual(rb.toArray(), []);
  assert.equal(rb.size, 0);
});

test('RingBuffer rejects invalid capacity', () => {
  assert.throws(() => new RingBuffer(0), TypeError);
  assert.throws(() => new RingBuffer(-1), TypeError);
  assert.throws(() => new RingBuffer(1.5), TypeError);
  assert.throws(() => new RingBuffer('3'), TypeError);
});

test('ConsoleInterceptor forwards calls to original console', () => {
  const fake = makeFakeConsole();
  const interceptor = new ConsoleInterceptor({ console: fake });
  interceptor.start();
  fake.log('hello', 42);
  fake.warn('careful');
  assert.deepEqual(fake.calls, [
    ['log', ['hello', 42]],
    ['warn', ['careful']],
  ]);
  interceptor.restore();
});

test('ConsoleInterceptor captures calls into ring buffer', () => {
  const fake = makeFakeConsole();
  const interceptor = new ConsoleInterceptor({ console: fake });
  interceptor.start();
  fake.log('a');
  fake.error('b', { code: 1 });
  const entries = interceptor.getEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].method, 'log');
  assert.deepEqual(entries[0].args, ['a']);
  assert.equal(entries[1].method, 'error');
  assert.deepEqual(entries[1].args, ['b', { code: 1 }]);
  interceptor.restore();
});

test('ConsoleInterceptor respects capacity', () => {
  const fake = makeFakeConsole();
  const interceptor = new ConsoleInterceptor({ console: fake, capacity: 2 });
  interceptor.start();
  fake.log(1);
  fake.log(2);
  fake.log(3);
  const entries = interceptor.getEntries();
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].args, [2]);
  assert.deepEqual(entries[1].args, [3]);
  interceptor.restore();
});

test('ConsoleInterceptor restore puts originals back', () => {
  const fake = makeFakeConsole();
  const originalLog = fake.log;
  const interceptor = new ConsoleInterceptor({ console: fake });
  interceptor.start();
  assert.notEqual(fake.log, originalLog);
  interceptor.restore();
  assert.equal(fake.log, originalLog);
  interceptor.restore(); // idempotent
  assert.equal(fake.log, originalLog);
});

test('ConsoleInterceptor start is idempotent', () => {
  const fake = makeFakeConsole();
  const interceptor = new ConsoleInterceptor({ console: fake });
  interceptor.start();
  const wrappedLog = fake.log;
  interceptor.start();
  assert.equal(fake.log, wrappedLog);
  interceptor.restore();
});

test('ConsoleInterceptor only wraps methods that exist and are functions', () => {
  const fake = makeFakeConsole();
  delete fake.debug;
  const interceptor = new ConsoleInterceptor({ console: fake });
  interceptor.start();
  fake.log('ok');
  assert.equal(interceptor.getEntries().length, 1);
  assert.equal(typeof fake.debug, 'undefined');
  interceptor.restore();
});

test('ConsoleInterceptor clear removes captured entries', () => {
  const fake = makeFakeConsole();
  const interceptor = new ConsoleInterceptor({ console: fake });
  interceptor.start();
  fake.log('one');
  fake.log('two');
  interceptor.clear();
  assert.deepEqual(interceptor.getEntries(), []);
  assert.equal(interceptor.size, 0);
  interceptor.restore();
});

test('ConsoleInterceptor rejects empty methods array', () => {
  const fake = makeFakeConsole();
  assert.throws(() => new ConsoleInterceptor({ console: fake, methods: [] }), TypeError);
});

test('ConsoleInterceptor uses custom methods list', () => {
  const fake = makeFakeConsole();
  const interceptor = new ConsoleInterceptor({ console: fake, methods: ['error'] });
  interceptor.start();
  fake.log('not captured');
  fake.error('captured');
  const entries = interceptor.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].method, 'error');
  assert.equal(fake.calls.length, 2); // both forwarded
  interceptor.restore();
});
