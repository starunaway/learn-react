import { mixed } from '../types';

type JSXElementConstructor<P> = (props: P) => ReactNode;

type NonMaybeType<T> = T extends null | void ? never : T;

export interface ReactElement<
  P = any,
  // read:  T 可以是ReactText 类型？
  T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>
> {
  type: T;
  props: P;
  key: string | null;
}
export type RefObject = {
  current: any;
};

export type ReactNode =
  | ReactElement<any>
  | ReactPortal
  | ReactText
  | ReactFragment
  | ReactProvider<any>;
// fixme: 正常使用过程，应该不需要Consumer了，都是 useContext
// | ReactConsumer<any>;

export type ReactEmpty = null | void | boolean;

export type ReactFragment = ReactEmpty | Iterable<ReactNode>;

export type ReactText = string | number;

export type ReactProvider<T> = {
  $$typeof: Symbol | number;
  type: ReactProviderType<T>;
  key: null | string;
  ref: null;
  props: {
    value: T;
    children?: ReactNodeList;
  } & mixed;
} & mixed;

// fixme: 正常使用过程，应该不需要Consumer了，都是 useContext
// export type ReactConsumer<T> = {
//   $$typeof: Symbol | number;
//   type: ReactContext<T>;
//   key: null | string;
//   ref: null;
//   props: {
//     children: (value: T) => ReactNodeList;
//   } & mixed;
// } & mixed;

export type ReactNodeList = ReactEmpty | ReactNode;

export type ReactPortal = {
  $$typeof: Symbol | number;
  key: null | string;
  containerInfo: any;
  children: ReactNodeList;
  // TODO: figure out the API for cross-renderer implementation.
  implementation: any;
} & mixed;

export type ReactProviderType<T> = {
  $$typeof: Symbol | number;
  _context: ReactContext<T>;
} & mixed;

export type ReactContext<T> = {
  $$typeof: Symbol | number;
  Consumer: ReactContext<T> | null;
  Provider: ReactProviderType<T> | null;
  _currentValue: T | null;
  _currentValue2: T | null;
  _threadCount: number;
  // DEV only
  _currentRenderer?: Object | null;
  _currentRenderer2?: Object | null;
  // This value may be added by application code
  // to improve DEV tooling display names
  displayName?: string;

  // only used by ServerContext
  _defaultValue: T | null;
  _globalName: string | null;
} & mixed;

// Mutable source version can be anything (e.g. number, string, immutable data structure)
// so long as it changes every time any part of the source changes.
export type MutableSourceVersion = NonMaybeType<mixed>;

export type MutableSourceGetVersionFn = (source: NonMaybeType<mixed>) => MutableSourceVersion;

export type MutableSource<Source extends NonMaybeType<mixed>> = {
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

export interface Wakeable {
  then(onFulfill: () => mixed, onReject: () => mixed): void | Wakeable;
}

export type ReactScopeInstance = {
  DO_NOT_USE_queryAllNodes(ReactScopeQuery: any): null | Array<Object>;
  DO_NOT_USE_queryFirstNode(ReactScopeQuery: any): null | Object;
  containsNode(arg0: Object): boolean;
  getChildContextValues: <T>(context: ReactContext<T>) => Array<T>;
};

export type StartTransitionOptions = {
  name?: string;
};
