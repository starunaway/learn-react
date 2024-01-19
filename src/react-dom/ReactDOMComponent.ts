import { restoreControlledState as ReactDOMInputRestoreControlledState } from './ReactDOMInput';

/**
 * 处理用户输入类型
 * @param domElement
 * @param tag
 * @param props
 * @returns
 */
export function restoreControlledState(domElement: Element, tag: string, props: Object): void {
  switch (tag) {
    case 'input':
      ReactDOMInputRestoreControlledState(domElement as HTMLInputElement, props);
      return;
    // fixme: 先看 input 就够了
    // case 'textarea':
    //   ReactDOMTextareaRestoreControlledState(domElement, props);
    //   return;
    // case 'select':
    //   ReactDOMSelectRestoreControlledState(domElement, props);
    //   return;
  }
}
