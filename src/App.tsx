import { memo, createContext, useContext, useEffect, useState } from 'react';

const Cont = createContext({ length: 0 });

const Leng = () => {
  const { length } = useContext(Cont);
  const [a, setS] = useState(1);
  console.log('Leng render');
  return (
    <h1>
      {length}
      {a}

      <button
        onClick={() => {
          setS(a + 1);
        }}
      >
        Leng click
      </button>
    </h1>
  );
};

const Hello = ({ hello }: { hello: string }) => {
  console.log('hello render');

  useEffect(() => {
    console.log('hello useEffect');
    // setHello(hello);

    return () => {
      console.log('hello useEffect return');
    };
  }, [hello]);

  return (
    <span>
      input 内容: {hello}
      <Hello2></Hello2>
    </span>
  );
};
// todo memo 的代码没有调试到

const MemoHello = memo(Hello);

const Hello22 = () => {
  console.log('hello2 render');

  return (
    <p>
      p 标签内，hello2,下面是 hello3 组件
      <Hello3></Hello3>
    </p>
  );
};

const Hello2 = memo(Hello22);

const Hello3 = () => {
  console.log('hello3 render');
  // todo 这里调用下 context ?

  const onClick = () => {
    console.log('hello3 onClick');
  };

  return <p onClick={onClick}>hello3 组件</p>;
};

function App({ name }: { name: string }) {
  const [list, setList] = useState<number[]>([]);
  const [hello, setHello] = useState('');

  return (
    <div className="App">
      <Cont.Provider value={{ length: list.length }}>
        <pre>{list.length}</pre>
        <Leng></Leng>
      </Cont.Provider>
      <pre>hello {name}</pre>

      <MemoHello hello={hello}></MemoHello>

      {list.map((i) => {
        return <li key={i}>{i}</li>;
      })}

      <button
        onClick={() => {
          setList((v) => [...v, v.length]);
        }}
      >
        外面 click。长度+1 影响最上面和 Leng 的数字
      </button>
      <input onChange={(e) => setHello(e.target.value)}></input>
    </div>
  );
}

export default App;