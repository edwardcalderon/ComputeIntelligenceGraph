import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withExponentialBackoff } from '../retry.js';

describe('withExponentialBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the result immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withExponentialBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after one failure and returns result on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('recovered');

    const promise = withExponentialBackoff(fn, [5, 10, 20, 40, 60]);

    // Advance past the first delay (5s)
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('follows the [5,10,20,40,60] delay sequence', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValueOnce(new Error('e3'))
      .mockRejectedValueOnce(new Error('e4'))
      .mockRejectedValueOnce(new Error('e5'))
      .mockResolvedValue('done');

    const promise = withExponentialBackoff(fn, [5, 10, 20, 40, 60]);

    for (const ms of [5000, 10000, 20000, 40000, 60000]) {
      await vi.advanceTimersByTimeAsync(ms);
    }

    const result = await promise;
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('throws the last error after all retries are exhausted', async () => {
    const lastError = new Error('final failure');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValue(lastError);

    let error: Error | undefined;
    const promise = withExponentialBackoff(fn, [1, 2]).catch(e => { error = e; });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(error).toBe(lastError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
