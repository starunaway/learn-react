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

// 需要测试的： 1. 合成事件中同时 setstate 和 原生事件（settimeout）中setstate
// react 18 中，应该都是同时更新两个 state，只 render 一次
/**
 * 
 * 1
 *   <button
      onClick={() => {
        setCount1(count => count + 1);
        setCount2(count => count + 1);
        // 在React事件中被批处理
      }}
    >
      {`count1 is ${count1}, count2 is ${count2}`}
    </button>


2
  <div
      onClick={() => {
        setTimeout(() => {
          setCount1(count => count + 1);
          setCount2(count => count + 1);
        });
        // 在 setTimeout 中不会进行批处理
      }}
    >
      <div>count1： {count1}</div>
      <div>count2： {count2}</div>
    </div>


    3.
      useEffect(() => {
    document.body.addEventListener('click', () => {
      setCount1(count => count + 1);
      setCount2(count => count + 1);
    });
    // 在原生js事件中不会进行批处理
  }, []);





 * 
 * 
 */
// 2. children 默认下，组件是否被 memo。和 diff 相关

function App1({ name }: { name: string }) {
  return (
    <div className="App">
      <button>外面 click。长度+1 影响最上面和 Leng 的数字</button>
      <h5>{name}</h5>
      <input></input>
    </div>
  );
}

export default App1;
