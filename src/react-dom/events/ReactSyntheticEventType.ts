import { Fiber } from '../../react-reconciler/ReactInternalTypes';
import { mixed } from '../../types';

type BaseSyntheticEvent = {
  isPersistent: () => boolean;
  isPropagationStopped: () => boolean;
  _dispatchInstances?: null | Array<Fiber | null> | Fiber;
  _dispatchListeners?: null | Array<Function> | Function;
  _targetInst: Fiber | null;
  nativeEvent: Event;
  target?: null | EventTarget;
  relatedTarget?: mixed;
  type: string;
  currentTarget: null | EventTarget;
};

export type KnownReactSyntheticEvent = BaseSyntheticEvent & {
  _reactName: string;
};
export type UnknownReactSyntheticEvent = BaseSyntheticEvent & {
  _reactName: null;
};

export type ReactSyntheticEvent = KnownReactSyntheticEvent | UnknownReactSyntheticEvent;
