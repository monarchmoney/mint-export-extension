/**
 * Awaitable timeout.
 *
 * Usage:
 * await delay(500);
 */
const delay = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

export default delay;
