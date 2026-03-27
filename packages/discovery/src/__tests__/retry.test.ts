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

  it('follows the [5,10,20,40,60,60,...] delay sequence', async () => {
    const delays: number[] = [];
    const realSetTimeout = globalThis.setTimeout;

    // Spy on setTimeout to capture delay values
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb, ms, ...args) => {
      delays.push(ms as number);
      return realSetTimeout(cb, 0, ...args); // execute immediately for speed
    });

    // Fail 6 times then succeed — exercises all 5 default delays + cap
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValueOnce(new Error('e3'))
      .mockRejectedValueOnce(new Error('e4'))
      .mockRejectedValueOnce(new Error('e5'))
      .mockRejectedValueOnce(new Error('e6'))
      .mockResolvedValue('done');

    const result = await withExponentialBackoff(fn, [5, 10, 20, 40, 60]);

    expect(result).toBe('done');
    // 6 failures → 6 delays; last two should be capped at 60s
    const delaysSec = delays.map((ms) => ms / 1000);
    expect(delaysSec).toEqual([5, 10, 20, 40, 60, 60]);

    spy.mockRestore();
  });

  it('throws the last error after all retries are exhausted', async () => {
    const lastError = new Error('final failure');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValue(lastError);

    const promise = withExponentialBackoff(fn, [1, 2]);

    // Advance through both delays
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).rejects.toThrow('final failure');
    // initial call + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
