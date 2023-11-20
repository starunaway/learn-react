import { Fiber } from './ReactInternalTypes';

export function getStackByFiberInDevAndProd(workInProgress: Fiber): string {
  try {
    let info = '';
    let node: Fiber | null = workInProgress;
    do {
      info += workInProgress.type + ' ';
      node = node.return;
    } while (node);
    return info;
  } catch (x: any) {
    return '\nError generating stack: ' + x.message + '\n' + x.stack;
  }
}
