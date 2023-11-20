import { Fiber } from './ReactInternalTypes';

export type StackCursor<T> = { current: T };
let index = -1;

const valueStack: Array<any> = [];

let fiberStack: Array<Fiber | null>;
export function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  };
}

export function isEmpty(): boolean {
  return index === -1;
}

export function pop<T>(cursor: StackCursor<T>, fiber: Fiber): void {
  if (index < 0) {
    console.error('Unexpected pop.');
    return;
  }

  if (fiber !== fiberStack[index]) {
    console.error('Unexpected Fiber popped.');
  }

  cursor.current = valueStack[index];

  valueStack[index] = null;

  //   if (__DEV__) {
  //     fiberStack[index] = null;
  //   }

  index--;
}

export function push<T>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index++;

  valueStack[index] = cursor.current;

  //   if (__DEV__) {
  //     fiberStack[index] = fiber;
  //   }

  cursor.current = value;
}
