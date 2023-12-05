import { StackCursor, createCursor, push } from './ReactFiberStack';
import { Fiber } from './ReactInternalTypes';

export const emptyContextObject = {};

const contextStackCursor: StackCursor<Object> = createCursor(emptyContextObject);
const didPerformWorkStackCursor: StackCursor<boolean> = createCursor(false);

let previousContext: Object = emptyContextObject;

// 不启动
const disableLegacyContext = false;

function hasContextChanged(): boolean {
  if (disableLegacyContext) {
    return false;
  } else {
    return didPerformWorkStackCursor.current;
  }
}

function pushTopLevelContextObject(fiber: Fiber, context: Object, didChange: boolean): void {
  if (disableLegacyContext) {
    return;
  } else {
    if (contextStackCursor.current !== emptyContextObject) {
      throw new Error(
        'Unexpected context found on stack. ' +
          'This error is likely caused by a bug in React. Please file an issue.'
      );
    }

    push(contextStackCursor, context, fiber);
    push(didPerformWorkStackCursor, didChange, fiber);
  }
}

export function findCurrentUnmaskedContext(fiber: Fiber): Object {
  // if (disableLegacyContext) {
  return emptyContextObject;
  // } else {
  //   // Currently this is only used with renderSubtreeIntoContainer; not sure if it
  //   // makes sense elsewhere
  //   if (!isFiberMounted(fiber) || fiber.tag !== ClassComponent) {
  //     throw new Error(
  //       'Expected subtree parent to be a mounted class component. ' +
  //         'This error is likely caused by a bug in React. Please file an issue.',
  //     );
  //   }

  //   let node = fiber;
  //   do {
  //     switch (node.tag) {
  //       case HostRoot:
  //         return node.stateNode.context;
  //       case ClassComponent: {
  //         const Component = node.type;
  //         if (isContextProvider(Component)) {
  //           return node.stateNode.__reactInternalMemoizedMergedChildContext;
  //         }
  //         break;
  //       }
  //     }
  //     node = node.return;
  //   } while (node !== null);

  //   throw new Error(
  //     'Found unexpected detached subtree parent. ' +
  //       'This error is likely caused by a bug in React. Please file an issue.',
  //   );
  // }
}

function isContextProvider(type: Function & { childContextTypes?: any }): boolean {
  if (disableLegacyContext) {
    return false;
  } else {
    const childContextTypes = type.childContextTypes;
    return childContextTypes !== null && childContextTypes !== undefined;
  }
}

function cacheContext(workInProgress: Fiber, unmaskedContext: Object, maskedContext: Object): void {
  if (disableLegacyContext) {
    return;
  } else {
    const instance = workInProgress.stateNode;
    instance.__reactInternalMemoizedUnmaskedChildContext = unmaskedContext;
    instance.__reactInternalMemoizedMaskedChildContext = maskedContext;
  }
}

export function getUnmaskedContext(
  workInProgress: Fiber,
  Component: Function,
  didPushOwnContextIfProvider: boolean
): Object {
  if (disableLegacyContext) {
    return emptyContextObject;
  } else {
    if (didPushOwnContextIfProvider && isContextProvider(Component)) {
      // If the fiber is a context provider itself, when we read its context
      // we may have already pushed its own child context on the stack. A context
      // provider should not "see" its own child context. Therefore we read the
      // previous (parent) context instead for a context provider.
      return previousContext;
    }
    return contextStackCursor.current;
  }
}

export function getMaskedContext(
  workInProgress: Fiber,
  unmaskedContext: Record<string, any>
): Record<string, any> {
  if (disableLegacyContext) {
    return emptyContextObject;
  } else {
    const type = workInProgress.type;
    const contextTypes = type.contextTypes;
    if (!contextTypes) {
      return emptyContextObject;
    }

    // Avoid recreating masked context unless unmasked context has changed.
    // Failing to do this will result in unnecessary calls to componentWillReceiveProps.
    // This may trigger infinite loops if componentWillReceiveProps calls setState.
    const instance = workInProgress.stateNode;
    if (instance && instance.__reactInternalMemoizedUnmaskedChildContext === unmaskedContext) {
      return instance.__reactInternalMemoizedMaskedChildContext;
    }

    const context: Record<string, any> = {};
    for (const key in contextTypes) {
      context[key] = unmaskedContext[key];
    }

    // if (__DEV__) {
    //   const name = getComponentNameFromFiber(workInProgress) || 'Unknown';
    //   checkPropTypes(contextTypes, context, 'context', name);
    // }

    // Cache unmasked context so we can avoid recreating masked context unless necessary.
    // Context is created before the class component is instantiated so check for instance.
    if (instance) {
      cacheContext(workInProgress, unmaskedContext, context);
    }

    return context;
  }
}

export { hasContextChanged as hasLegacyContextChanged, pushTopLevelContextObject };
