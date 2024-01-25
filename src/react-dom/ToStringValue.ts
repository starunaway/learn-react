import { mixed } from '../types';

export type ToStringValue = boolean | number | Object | string | null | void;

// Flow does not allow string concatenation of most non-string types. To work
// around this limitation, we use an opaque type that can only be obtained by
// passing the value through getToStringValue first.
export function toString(value: ToStringValue): string {
  // The coercion safety check is performed in getToStringValue().
  return '' + value;
}

export function getToStringValue(value: any): ToStringValue {
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'undefined':
      return value;
    case 'object':
      return value;
    default:
      // function, symbol are assigned as empty strings
      return '';
  }
}
