export type StackCursor<T> = { current: T };

function createCursor<T>(defaultValue: T): StackCursor<T> {
  return {
    current: defaultValue,
  };
}

export { createCursor };
