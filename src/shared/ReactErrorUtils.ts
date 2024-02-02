import { mixed } from '../types';

// Used by Fiber to simulate a try-catch.
let hasError: boolean = false;
let caughtError: Error | null = null;

// Used by event system to capture/rethrow the first error.
let hasRethrowError: boolean = false;
let rethrowError: mixed | null = null;

const reporter = {
  onError(error: mixed) {
    hasError = true;
    caughtError = error as Error;
  },
};
export function invokeGuardedCallbackImpl<A, B, C, D, E, F, Context>(
  name: string | null,
  func: Function,
  context: Context,
  a: A,
  b: B,
  c: C,
  d: D,
  e: E,
  f: F
) {
  const funcArgs = Array.prototype.slice.call(arguments, 3) as [A, B, C, D, E, F];
  try {
    // read: 目前用到的地方：1. 用户注册的 dom 事件
    console.log('invokeGuardedCallbackImpl:', func, context, funcArgs);
    func.apply(context, funcArgs);
  } catch (error) {
    // read: 这里应该用不到层层嵌套，后面简化下
    console.warn('reporter.onError:这里应该用不到层层嵌套，后面简化下');
    // @ts-ignore
    this.onError(error);
  }
}

/**
 * Call a function while guarding against errors that happens within it.
 * Returns an error if it throws, otherwise null.
 *
 * In production, this is implemented using a try-catch. The reason we don't
 * use a try-catch directly is so that we can swap out a different
 * implementation in DEV mode.
 *
 * @param {String} name of the guard to use for logging or debugging
 * @param {Function} func The function to invoke
 * @param {*} context The context to use when calling the function
 * @param {...*} args Arguments for function
 */
export function invokeGuardedCallback<A, B, C, D, E, F, Context>(
  name: string | null,
  func: Function,
  context: Context,
  a: A,
  b: B,
  c: C,
  d: D,
  e: E,
  f: F
): void {
  hasError = false;
  caughtError = null;
  console.warn('invokeGuardedCallback:这里应该用不到层层嵌套，后面简化下');
  invokeGuardedCallbackImpl.apply(reporter, arguments as any);
}
/**
 * read: 这里是重写了 React 源码的一些逻辑，可能有问题
 * Same as invokeGuardedCallback, but instead of returning an error, it stores
 * it in a global so it can be rethrown by `rethrowCaughtError` later.
 * TODO: See if caughtError and rethrowError can be unified.
 *
 * @param {String} name of the guard to use for logging or debugging
 * @param {Function} func The function to invoke
 * @param {*} context The context to use when calling the function
 * @param {...*} args Arguments for function
 */
export function invokeGuardedCallbackAndCatchFirstError<A, B, C, D, E, F, Context>(
  name: string | null,
  func: Function,
  context: Context,
  ...args: any[]
): void {
  console.warn('invokeGuardedCallbackAndCatchFirstError:这里应该用不到层层嵌套，后面简化下');
  // @ts-ignore
  // read: 这里是否可以简写？实际上用不到开发模式下额外的信息提示
  invokeGuardedCallback.apply(this, arguments);

  if (hasError) {
    const error = clearCaughtError();
    if (!hasRethrowError) {
      hasRethrowError = true;
      rethrowError = error;
    }
  }
}

/**
 * read: 在某些情况，报错是出现在 react 流程中的，并不是发生在用户侧。需要在合适的时机抛出给用户
 * 比如，在 React 合成事件中
 * During execution of guarded functions we will capture the first error which
 * we will rethrow to be handled by the top level error handler.
 */
export function rethrowCaughtError() {
  if (hasRethrowError) {
    const error = rethrowError;
    hasRethrowError = false;
    rethrowError = null;
    throw error;
  }
}

export function clearCaughtError() {
  if (hasError) {
    const error = caughtError;
    hasError = false;
    caughtError = null;
    return error;
  } else {
    throw new Error(
      'clearCaughtError was called but no error was captured. This error ' +
        'is likely caused by a bug in React. Please file an issue.'
    );
  }
}
