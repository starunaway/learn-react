export type RefObject = {
  current: any;
};

export type ReactNode = ReactElement;
// | ReactPortal
// | ReactText
// | ReactFragment
// | ReactProvider<any>
// | ReactConsumer<any>;

export type ReactEmpty = null | void | boolean;

export type ReactNodeList = ReactEmpty | ReactNode;

export type ReactElement = {
  $$typeof: any;
  type: any;
  key: any;
  ref: any;
  props: any;
  // ReactFiber
  _owner: any;
};

export type ReactProviderType<T> = {
  $$typeof: Symbol | number;
  _context: ReactContext<T>;
};

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
};

export type ReactPortal = {
  $$typeof: Symbol | number;
  key: null | string;
  containerInfo: any;
  children: ReactNodeList;
  // TODO: figure out the API for cross-renderer implementation.
  implementation: any;
  [key: string]: any;
};

export type ReactFragment = ReactEmpty | Iterable<ReactNode>;
export type MutableSourceVersion = any;

export type MutableSourceGetVersionFn = (source: any) => MutableSourceVersion;

export type MutableSource<Source extends any> = {
  _source: Source;

  _getVersion: MutableSourceGetVersionFn;

  // Tracks the version of this source at the time it was most recently read.
  // Used to determine if a source is safe to read from before it has been subscribed to.
  // Version number is only used during mount,
  // since the mechanism for determining safety after subscription is expiration time.
  //
  // As a workaround to support multiple concurrent renderers,
  // we categorize some renderers as primary and others as secondary.
  // We only expect there to be two concurrent renderers at most:
  // React Native (primary) and Fabric (secondary);
  // React DOM (primary) and React ART (secondary).
  // Secondary renderers store their context values on separate fields.
  // We use the same approach for Context.
  _workInProgressVersionPrimary: null | MutableSourceVersion;
  _workInProgressVersionSecondary: null | MutableSourceVersion;

  // DEV only
  // Used to detect multiple renderers using the same mutable source.
  // _currentPrimaryRenderer?: Object | null,
  // _currentSecondaryRenderer?: Object | null,

  // DEV only
  // Used to detect side effects that update a mutable source during render.
  // See https://github.com/facebook/react/issues/19948
  // _currentlyRenderingFiber?: Fiber | null,
  // _initialVersionAsOfFirstRender?: MutableSourceVersion | null,
};

// The subset of a Thenable required by things thrown by Suspense.
// This doesn't require a value to be passed to either handler.
export interface Wakeable {
  then(onFulfill: () => any, onReject: () => any): void | Wakeable;
}

// The subset of a Promise that React APIs rely on. This resolves a value.
// This doesn't require a return value neither from the handler nor the
// then function.
export interface Thenable<R> {
  then<U>(
    onFulfill: (value: R) => void | Thenable<U> | U,
    onReject: (error: any) => void | Thenable<U> | U
  ): void | Thenable<U>;
}

export type OffscreenMode = 'hidden' | 'unstable-defer-without-hiding' | 'visible';

export type StartTransitionOptions = {
  name?: string;
};
