import * as React from '@/react';

const ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

// todo 这里使用的地方直接从 react 导出
// 可能会出现循环依赖的问题
export default ReactSharedInternals;
