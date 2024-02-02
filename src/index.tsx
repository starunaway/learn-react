// import ReactDOM from 'react-dom/client';
import { createRoot } from './react-dom';
import App from './App';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App name="1" />);
