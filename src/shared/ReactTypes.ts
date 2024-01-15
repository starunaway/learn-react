import { mixed } from '../types';

export type RefObject = {
  current: any;
};

export type ReactProviderType<T> = {
  $$typeof: Symbol | number;
  _context: ReactContext<T>;
} & mixed;

export type ReactContext<T> = {
  $$typeof: Symbol | number;
  Consumer: ReactContext<T>;
  Provider: ReactProviderType<T>;
  _currentValue: T;
  _currentValue2: T;
  _threadCount: number;
  // DEV only
  _currentRenderer?: Object | null;
  _currentRenderer2?: Object | null;
  // This value may be added by application code
  // to improve DEV tooling display names
  displayName?: string;

  // only used by ServerContext
  _defaultValue: T;
  _globalName: string;
} & mixed;

export interface Wakeable {
  then(onFulfill: () => mixed, onReject: () => mixed): void | Wakeable;
}
