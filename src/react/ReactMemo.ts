import { FunctionComponent } from 'react';
import { ReactElement } from '../shared/ReactElementType';
import { REACT_MEMO_TYPE } from '../shared/ReactSymbols';

export function memo<Props>(
  type: FunctionComponent<Props>,
  compare?: (oldProps: Props, newProps: Props) => boolean
): any {
  const elementType = {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare,
  };

  return elementType;
}
