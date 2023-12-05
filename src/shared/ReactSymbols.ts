export const REACT_ELEMENT_TYPE = Symbol.for('react.element');
export const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
export const REACT_LAZY_TYPE = Symbol.for('react.lazy');
export const REACT_PORTAL_TYPE = Symbol.for('react.portal');

const MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = '@@iterator';

export function getIteratorFn(maybeIterable: any): null | (() => Iterator<any>) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }
  const maybeIterator =
    (MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL]) ||
    maybeIterable[FAUX_ITERATOR_SYMBOL];
  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }
  return null;
}
