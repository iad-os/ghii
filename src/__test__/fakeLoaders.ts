export const fakeTimeoutLoader = <T>(value: T, timeout: number): Promise<T> =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve(value);
    }, timeout);
  });
