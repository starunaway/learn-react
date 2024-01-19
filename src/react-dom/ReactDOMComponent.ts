import { restoreControlledState as ReactDOMInputRestoreControlledState } from './ReactDOMInput';

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
