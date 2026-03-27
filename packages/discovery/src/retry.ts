const DEFAULT_DELAYS = [5, 10, 20, 40, 60]; // seconds

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  delays: number[] = DEFAULT_DELAYS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= delays.length) {
        // All retries exhausted
        break;
      }
      const delaySec = delays[Math.min(attempt, delays.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
    }
  }

  throw lastError;
}
