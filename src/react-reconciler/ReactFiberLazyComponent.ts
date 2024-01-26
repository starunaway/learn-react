export function resolveDefaultProps(Component: any, baseProps: Object): Object {
  if (Component && Component.defaultProps) {
    // Resolve default props. Taken from ReactElement
    const props = Object.assign({}, baseProps);
    const defaultProps = Component.defaultProps;
    for (const propName in defaultProps) {
      if (props[propName as keyof Object] === undefined) {
        props[propName as keyof Object] = defaultProps[propName];
      }
    }
    return props;
  }
  return baseProps;
}
