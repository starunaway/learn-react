import { FiberRoot } from '../react-reconciler/ReactInternalTypes';
import { mixed } from '../types';

type TimeoutID = number;

export type TimeoutHandle = TimeoutID;
export type NoTimeout = -1;

export type SuspenseInstance = Comment & { _reactRetry?: () => void } & mixed;

// read: _reactRootContainer 是内部用到的，用户侧应该无感知
export type Container = (Element | Document | DocumentFragment) & {
  _reactRootContainer?: FiberRoot;
} & mixed;
