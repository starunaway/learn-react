export const supportsMicrotasks = true;

const localPromise = typeof Promise === 'function' ? Promise : undefined;

export const scheduleTimeout: any = typeof setTimeout === 'function' ? setTimeout : undefined;

export const scheduleMicrotask: any =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof localPromise !== 'undefined'
    ? (callback: (value: any) => PromiseLike<null> | null) =>
        localPromise.resolve(null).then(callback).catch(handleErrorInNextTick)
    : scheduleTimeout; // TODO: Determine the best fallback here.

function handleErrorInNextTick(error: any) {
  setTimeout(() => {
    throw error;
  });
}
