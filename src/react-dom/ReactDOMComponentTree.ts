import { Fiber } from '../react-reconciler/ReactInternalTypes';
import { WorkTag } from '../react-reconciler/ReactWorkTags';
import { ReactScopeInstance } from '../shared/ReactTypes';
import { mixed } from '../types';
import {
  Container,
  Instance,
  Props,
  SuspenseInstance,
  TextInstance,
  getParentSuspenseInstance,
} from './ReactFiberHostConfig';
import { ReactDOMEventHandleListener } from './shared/ReactDOMTypes';

const randomKey = Math.random().toString(36).slice(2);
const internalInstanceKey = '__reactFiber$' + randomKey;
const internalPropsKey = '__reactProps$' + randomKey;
const internalContainerInstanceKey = '__reactContainer$' + randomKey;
const internalEventHandlersKey = '__reactEvents$' + randomKey;
const internalEventHandlerListenersKey = '__reactListeners$' + randomKey;
const internalEventHandlesSetKey = '__reactHandles$' + randomKey;

export function markContainerAsRoot(hostRoot: Fiber | null, node: Container): void {
  console.log('markContainerAsRoot 看下这里hostRoot是啥,以及使用的时候是什么:', hostRoot);
  node[internalContainerInstanceKey] = hostRoot;
}

/**
 * Given a DOM node, return the closest HostComponent or HostText fiber ancestor.
 * If the target node is part of a hydrated or not yet rendered subtree, then
 * this may also return a SuspenseComponent or HostRoot to indicate that.
 * Conceptually the HostRoot fiber is a child of the Container node. So if you
 * pass the Container node as the targetNode, you will not actually get the
 * HostRoot back. To get to the HostRoot, you need to pass a child of it.
 * The same thing applies to Suspense boundaries.
 * @param targetNode
 * @returns
 */

export function getClosestInstanceFromNode(targetNode: Node & mixed): null | Fiber {
  let targetInst = targetNode[internalInstanceKey];
  // read: react 给每个 dom 节点都打上了标记。如果有此标记，说明已经找到了目标节点
  if (targetInst) {
    // Don't return HostRoot or SuspenseComponent here.
    return targetInst;
  }
  // If the direct event target isn't a React owned DOM node, we need to look
  // to see if one of its parents is a React owned DOM node.
  // read: 这里是说可能不是 react 创建的 dom 节点。比如 jquery 或者其他的方法
  let parentNode: (Node & mixed) | null = targetNode.parentNode;
  while (parentNode) {
    // We'll check if this is a container root that could include
    // React nodes in the future. We need to check this first because
    // if we're a child of a dehydrated container, we need to first
    // find that inner container before moving on to finding the parent
    // instance. Note that we don't check this field on  the targetNode
    // itself because the fibers are conceptually between the container
    // node and the first child. It isn't surrounding the container node.
    // If it's not a container, we check if it's an instance.
    targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey];
    if (targetInst) {
      // Since this wasn't the direct target of the event, we might have
      // stepped past dehydrated DOM nodes to get here. However they could
      // also have been non-React nodes. We need to answer which one.

      // read: 这里也说可能不是 react 创建的节点。并且通常情况下用户可能会通过 ref 来获取
      // If we the instance doesn't have any children, then there can't be
      // a nested suspense boundary within it. So we can use this as a fast
      // bailout. Most of the time, when people add non-React children to
      // the tree, it is using a ref to a child-less DOM node.
      // read: 这里只对找到的第一个外层节点判断，比如 innerHtml 里面的可能有很多节点
      // read: 需要再次看一下
      // Normally we'd only need to check one of the fibers because if it
      // has ever gone from having children to deleting them or vice versa
      // it would have deleted the dehydrated boundary nested inside already.
      // However, since the HostRoot starts out with an alternate it might
      // have one on the alternate so we need to check in case this was a
      // root.
      const alternate = targetInst.alternate;
      if (targetInst.child !== null || (alternate !== null && alternate.child !== null)) {
        // Next we need to figure out if the node that skipped past is
        // nested within a dehydrated boundary and if so, which one.
        let suspenseInstance = getParentSuspenseInstance(targetNode);
        while (suspenseInstance !== null) {
          // We found a suspense instance. That means that we haven't
          // hydrated it yet. Even though we leave the comments in the
          // DOM after hydrating, and there are boundaries in the DOM
          // that could already be hydrated, we wouldn't have found them
          // through this pass since if the target is hydrated it would
          // have had an internalInstanceKey on it.
          // Let's get the fiber associated with the SuspenseComponent
          // as the deepest instance.
          const targetSuspenseInst = suspenseInstance[internalInstanceKey];
          if (targetSuspenseInst) {
            return targetSuspenseInst;
          }
          // If we don't find a Fiber on the comment, it might be because
          // we haven't gotten to hydrate it yet. There might still be a
          // parent boundary that hasn't above this one so we need to find
          // the outer most that is known.
          suspenseInstance = getParentSuspenseInstance(suspenseInstance);
          // If we don't find one, then that should mean that the parent
          // host component also hasn't hydrated yet. We can return it
          // below since it will bail out on the isMounted check later.
        }
      }
      return targetInst;
    }
    targetNode = parentNode;
    parentNode = targetNode.parentNode;
  }
  return null;
}

/**
 * Given a DOM node, return the ReactDOMComponent or ReactDOMTextComponent
 * instance, or null if the node was not rendered by this React.
 */
export function getInstanceFromNode(node: Node & mixed): Fiber | null {
  const inst: Fiber | null = node[internalInstanceKey] || node[internalContainerInstanceKey];
  if (inst) {
    if (
      inst.tag === WorkTag.HostComponent ||
      inst.tag === WorkTag.HostText ||
      inst.tag === WorkTag.SuspenseComponent ||
      inst.tag === WorkTag.HostRoot
    ) {
      return inst;
    } else {
      return null;
    }
  }
  return null;
}

export function getFiberCurrentPropsFromNode(
  node: (Instance | TextInstance | SuspenseInstance) & mixed
): Props {
  return node[internalPropsKey] || null;
}

/**
 * Given a ReactDOMComponent or ReactDOMTextComponent, return the corresponding
 * DOM node.
 */
export function getNodeFromInstance(inst: Fiber): Instance | TextInstance {
  console.log('getNodeFromInstance 运行时这里的 tag 一定是下面这两种吗？');
  if (inst.tag === WorkTag.HostComponent || inst.tag === WorkTag.HostText) {
    // In Fiber this, is just the state node right now. We assume it will be
    // a host component or host text.
    return inst.stateNode;
  }

  // Without this first invariant, passing a non-DOM-component triggers the next
  // invariant for a missing parent, which is super confusing.
  throw new Error('getNodeFromInstance: Invalid argument.');
}

export function getEventHandlerListeners(
  scope: EventTarget | ReactScopeInstance
): null | Set<ReactDOMEventHandleListener> {
  return (scope as any)[internalEventHandlerListenersKey] || null;
}
