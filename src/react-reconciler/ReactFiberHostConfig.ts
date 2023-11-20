import { Container } from './ReactInternalTypes';

export const supportsMicrotasks = true;

type SelectionInformation = {
  focusedElem: null | HTMLElement;
  selectionRange: any;
};

let eventsEnabled: boolean | null = null;
let selectionInformation: null | SelectionInformation = null;

const localPromise = typeof Promise === 'function' ? Promise : undefined;

export const scheduleTimeout: any = typeof setTimeout === 'function' ? setTimeout : undefined;

export const scheduleMicrotask: any =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof localPromise !== 'undefined'
    ? (callback: (value: any) => PromiseLike<null> | null) =>
        localPromise.resolve(null).then(callback).catch(handleErrorInNextTick)
    : scheduleTimeout; // TODO: Determine the best fallback here.

function handleErrorInNextTick(error: any) {
  setTimeout(() => {
    throw error;
  });
}

export const noTimeout = -1;

export const cancelTimeout = clearTimeout;

export function resetAfterCommit(containerInfo: Container): void {
  // 重置选中
  // restoreSelection(selectionInformation);
  //  官方也不确定是否有用
  // ReactBrowserEventEmitterSetEnabled(eventsEnabled);
  eventsEnabled = null;
  selectionInformation = null;
}

export const isPrimaryRenderer = true;
