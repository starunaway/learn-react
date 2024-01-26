import { getStackByFiberInDevAndProd } from './ReactFiberComponentStack';
import { Fiber } from './ReactInternalTypes';

export type CapturedValue<T> = {
  value: T;
  source: Fiber | null;
  stack: string | null;
  digest: string | null;
};

export function createCapturedValueAtFiber<T>(value: T, source: Fiber): CapturedValue<T> {
  // If the value is an error, call this function immediately after it is thrown
  // so the stack is accurate.
  return {
    value,
    source,
    stack: getStackByFiberInDevAndProd(source),
    digest: null,
  };
}
