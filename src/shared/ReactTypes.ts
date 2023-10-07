export type RefObject = {
  current: any;
};

export type ReactNode = ReactElement;
// | ReactPortal
// | ReactText
// | ReactFragment
// | ReactProvider<any>
// | ReactConsumer<any>;

export type ReactEmpty = null | void | boolean;

export type ReactNodeList = ReactEmpty | ReactNode;

export type ReactElement = {
  $$typeof: any;
  type: any;
  key: any;
  ref: any;
  props: any;
  // ReactFiber
  _owner: any;
};
