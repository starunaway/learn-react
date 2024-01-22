export type Heap<T extends Node> = Array<T>;
type Node = {
  id: number;
  sortIndex: number;
};

/**
 * 将一个节点添加到堆中，并通过siftUp方法将节点维持堆的性质。添加节点后，节点会被推到堆的末尾，然后通过上升泡排序的方式将其与父节点交换直到满足堆的性质
 * @param heap
 * @param node
 */
export function push<T extends Node>(heap: Heap<T>, node: T): void {
  const index = heap.length;
  heap.push(node);
  siftUp(heap, node, index);
}

/**
 * 获取堆栈的顶部节点，如果堆栈为空，则返回null。
 * @param heap
 * @returns
 */
export function peek<T extends Node>(heap: Heap<T>): T | null {
  return heap.length === 0 ? null : heap[0];
}

/**
 * 从堆中弹出根节点，并保持堆的性质不变。如果堆为空，则返回null。否则，将根节点与堆的最后一个节点交换，并将新根节点下滤到合适位置以保持堆的性质。最后返回原来的根节点。
 * @param heap
 * @returns
 */
export function pop<T extends Node>(heap: Heap<T>): T | null {
  if (heap.length === 0) {
    return null;
  }
  const first = heap[0];
  const last = heap.pop();
  if (last !== first) {
    heap[0] = last!;
    siftDown(heap, last!, 0);
  }
  return first;
}

function siftUp<T extends Node>(heap: Heap<T>, node: T, i: number) {
  let index = i;
  while (index > 0) {
    /**
     * read:无符号右移运算符。它将一个数的二进制表示向右移动指定的位数，同时在左侧补零，并且不会考虑符号位（即视为正数进行移位）。在这个场景中，(index - 1) >>> 1 的目的是计算父节点的索引，对于二叉堆而言，父节点的索引等于子节点索引除以2向下取整，通过右移一位实现该计算，并确保结果始终为整数。
     */
    const parentIndex = (index - 1) >>> 1;
    const parent = heap[parentIndex];
    if (compare(parent, node) > 0) {
      // The parent is larger. Swap positions.
      heap[parentIndex] = node;
      heap[index] = parent;
      index = parentIndex;
    } else {
      // The parent is smaller. Exit.
      return;
    }
  }
}

function siftDown<T extends Node>(heap: Heap<T>, node: T, i: number) {
  let index = i;
  const length = heap.length;
  const halfLength = length >>> 1;
  while (index < halfLength) {
    const leftIndex = (index + 1) * 2 - 1;
    const left = heap[leftIndex];
    const rightIndex = leftIndex + 1;
    const right = heap[rightIndex];

    // If the left or right node is smaller, swap with the smaller of those.
    if (compare(left, node) < 0) {
      if (rightIndex < length && compare(right, left) < 0) {
        heap[index] = right;
        heap[rightIndex] = node;
        index = rightIndex;
      } else {
        heap[index] = left;
        heap[leftIndex] = node;
        index = leftIndex;
      }
    } else if (rightIndex < length && compare(right, node) < 0) {
      heap[index] = right;
      heap[rightIndex] = node;
      index = rightIndex;
    } else {
      // Neither child is smaller. Exit.
      return;
    }
  }
}

function compare(a: Node, b: Node) {
  // Compare sort index first, then task id.
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
