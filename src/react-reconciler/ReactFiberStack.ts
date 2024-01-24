import { mixed } from '../types';
import { Fiber } from './ReactInternalTypes';

export type StackCursor<T> = { current: T };
const valueStack: Array<any> = [];

let fiberStack: Array<Fiber | null>;

let index = -1;
function pop<T extends any>(cursor: StackCursor<T>, fiber: Fiber): void {
  if (index < 0) {
    return;
  }

  cursor.current = valueStack[index];

  valueStack[index] = null;

  index--;
}

function push<T extends any>(cursor: StackCursor<T>, value: T, fiber: Fiber): void {
  index++;

  valueStack[index] = cursor.current;

  cursor.current = value;
}

function createCursor<T extends any>(defaultValue: T | null): StackCursor<T | null> {
  return {
    current: defaultValue,
  };
}

export { createCursor, pop, push };
