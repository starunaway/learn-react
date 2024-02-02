import { Dispatcher } from '../react-reconciler/ReactInternalTypes';
import { ReactContext } from '../shared/ReactTypes';
import ReactCurrentDispatcher from './ReactCurrentDispatcher';

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;

  // Will result in a null access error if accessed outside render phase. We
  // intentionally don't throw our own error because this is in a hot path.
  // Also helps ensure this is inlined.
  return dispatcher as Dispatcher;
}

type BasicStateAction<S> = ((state: S) => S) | S;
type Dispatch<A> = (action: A) => void;
export function useContext<T>(Context: ReactContext<T>): T {
  const dispatcher = resolveDispatcher();

  return dispatcher.useContext(Context);
}

export function useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useEffect(create: () => (() => void) | void, deps: Array<any> | void | null): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}
