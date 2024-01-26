import { Fiber } from './ReactInternalTypes';

function describeFiber(fiber: Fiber): string {
  console.error('这里看起来是报错信息的堆栈，正常情况下走不到这里，先不做');
  return '';
}

export function getStackByFiberInDevAndProd(workInProgress: Fiber): string {
  try {
    let info = '';
    let node: Fiber | null = workInProgress;
    do {
      info += describeFiber(node);
      node = node.return;
    } while (node);
    return info;
  } catch (x: any) {
    return '\nError generating stack: ' + x.message + '\n' + x.stack;
  }
}
