const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function retry<T>(
  task: () => Promise<T>,
  retries = 3,
  baseMs = 200,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(baseMs * 2 ** attempt);
    }
  }
}
