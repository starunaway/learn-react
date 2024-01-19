function sanitizeURL(url: string) {
  // read: 比如 <a href="javascript: console.log('Hello, world!')">Click me</a>
  // 那么这里的 href 会被 react 警告。React 计划对该类型进行限制
  console.log('调用该函数的地方，都可以去掉这段逻辑了');
}

export default sanitizeURL;
