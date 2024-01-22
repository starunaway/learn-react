import { mixed } from '../types';

type JSXElementConstructor<P> = (props: P) => ReactNode;

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

export type ReactScopeInstance = {
  DO_NOT_USE_queryAllNodes(ReactScopeQuery: any): null | Array<Object>;
  DO_NOT_USE_queryFirstNode(ReactScopeQuery: any): null | Object;
  containsNode(arg0: Object): boolean;
  getChildContextValues: <T>(context: ReactContext<T>) => Array<T>;
};
