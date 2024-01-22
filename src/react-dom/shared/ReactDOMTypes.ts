import { ReactScopeInstance } from '../../shared/ReactTypes';
import type { DOMEventName } from '../events/DOMEventNames';

export type ReactDOMEventHandle = (
  target: EventTarget | ReactScopeInstance,
  // read: 这里的类型需要修改
  //   callback: (e: SyntheticEvent<EventTarget>) => void
  callback: (e: any) => void
) => () => void;

export type ReactDOMEventHandleListener = {
  // read: 这里的类型需要修改
  //   callback: (e: SyntheticEvent<EventTarget>) => void
  callback: (e: any) => void;
  capture: boolean;
  type: DOMEventName;
};
