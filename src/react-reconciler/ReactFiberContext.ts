import { Fiber } from './ReactInternalTypes';

export const emptyContextObject = {};

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
