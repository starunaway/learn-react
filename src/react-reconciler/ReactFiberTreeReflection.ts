import { Container } from '../react-dom/ReactFiberHostConfig';
import type { Fiber } from './ReactInternalTypes';
import { WorkTag } from './ReactWorkTags';

export function getContainerFromFiber(fiber: Fiber): null | Container {
  return fiber.tag === WorkTag.HostRoot ? fiber.stateNode.containerInfo : null;
}
