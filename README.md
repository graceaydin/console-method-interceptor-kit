# console-method-interceptor-kit

Wraps global console methods so every call is forwarded to the original method while also being captured in a fixed-size ring buffer for later retrieval.

## Usage

```js
import { ConsoleInterceptor } from 'console-method-interceptor-kit';

const interceptor = new ConsoleInterceptor({ capacity: 50 });
interceptor.start();

console.log('hello', 42);
console.warn('careful');

const entries = interceptor.getEntries();
// [
//   { method: 'log', args: ['hello', 42] },
//   { method: 'warn', args: ['careful'] }
// ]

interceptor.restore();
```

## Why this exists

When debugging or testing code that writes to the console, you often want to see the output as it happens and also inspect it programmatically afterwards. Monkey-patching console methods by hand is easy to get wrong: it is easy to lose the original method, to forget to restore it, or to grow an unbounded array that leaks memory in long-running processes.

This library makes a deliberate trade-off: it only keeps the most recent `capacity` calls. That bounds memory use and keeps `getEntries()` cheap, but it means older calls are discarded. If you need the full history, use a larger capacity or collect entries yourself after each call.

## API

### `new ConsoleInterceptor(options?)`

- `options.console` — the console object to intercept. Defaults to `globalThis.console`.
- `options.capacity` — ring buffer capacity. Defaults to `100`.
- `options.methods` — array of method names to wrap. Defaults to `['log', 'info', 'warn', 'error', 'debug']`.

### `interceptor.start()`

Replaces the selected console methods with wrappers. Idempotent.

### `interceptor.restore()`

Restores the original methods. Idempotent.

### `interceptor.getEntries()`

Returns captured calls in insertion order as `{ method, args }` objects.

### `interceptor.clear()`

Removes all captured entries without touching the console methods.

### `interceptor.size`

Number of captured entries.

### `interceptor.capacity`

Ring buffer capacity.

### `new RingBuffer(capacity)`

A standalone fixed-size circular buffer with `push(value)`, `toArray()`, `clear()`, `size`, and `capacity`.

## The awkward edge

If a console method is missing or is not a function, it is skipped rather than replaced. That means `start()` will not throw, but calls to that method will not be captured. This is intentional: some environments do not implement every console method, and silently skipping is less disruptive than crashing.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

