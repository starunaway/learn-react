import { RefObject } from '../shared/ReactTypes';
import { Flags, NoFlags } from './ReactFiberFlags';
import { Fiber } from './ReactInternalTypes';
import { TypeOfMode } from './ReactTypeOfMode';
import { WorkTag } from './ReactWorkTags';

export class FiberNode implements Fiber {
  tag: WorkTag;
  key: null | string;
  elementType: any;
  type: any;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;
  ref: null | (((handle: any) => void) & { _stringRef?: string }) | RefObject;

  pendingProps: any;
  memoizedProps: any;
  updateQueue: any;
  memoizedState: any;
  //   dependencies: any;

  mode: TypeOfMode;
  flags: Flags;
  subtreeFlags: Flags;
  deletions: Array<Fiber> | null;
  alternate: Fiber | null;

  stateNode: any;
  refCleanup?: (() => void) | null;
  nextEffect?: Fiber | null;
  firstEffect?: Fiber | null;
  lastEffect?: Fiber | null;
  actualDuration?: number | undefined;
  actualStartTime?: number | undefined;
  selfBaseDuration?: number | undefined;
  treeBaseDuration?: number | undefined;

  constructor(tag: WorkTag, pendingProps: any, key: null | string, mode: TypeOfMode) {
    // Instance
    this.tag = tag;
    this.key = key;
    this.elementType = null;
    this.type = null;

    // Fiber
    this.return = null;
    this.child = null;
    this.sibling = null;
    this.index = 0;

    this.ref = null;

    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;
    // this.dependencies = null;

    this.mode = mode;

    // Effects
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.deletions = null;

    // this.lanes = NoLanes;
    // this.childLanes = NoLanes;

    this.alternate = null;

    this.stateNode = null;
  }
}
