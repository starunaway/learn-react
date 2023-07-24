// import * as React from './react';

import * as ReactDOM from './react-dom/index.ts';

const App = (props: { name: string }) => {
  //   const [v, setV] = React.useState(1);
  return (
    <div
    // onClick={() => setV((v: number) => v + 2)}
    >
      <h1 title="foo">Hello {props.name}</h1>
      {/* <div>{v}</div> */}
    </div>
  );
};

console.log(App);

// ReactDOM.render(<App name="1"></App>, document.getElementById('root'));
ReactDOM.render(1, 2);
