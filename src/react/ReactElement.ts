const createTextElement = (text: string | number) => {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  };
};

export function createElement(type: any, props: Record<string, any>, ...children: any) {
  console.log('createElement');
  return {
    type,
    props: {
      ...props,
      children: children.map((child: any) =>
        typeof child === 'object' ? child : createTextElement(child)
      ),
    },
  };
}
