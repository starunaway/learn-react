export type ToStringValue = boolean | number | Object | string | null | void;

// Flow does not allow string concatenation of most non-string types. To work
// around this limitation, we use an opaque type that can only be obtained by
// passing the value through getToStringValue first.
export function toString(value: ToStringValue): string {
  // The coercion safety check is performed in getToStringValue().
  // eslint-disable-next-line react-internal/safe-string-coercion
  return '' + value;
}
