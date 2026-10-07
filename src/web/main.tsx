import { render } from 'preact';

function App() {
  return <h1>Gerador de relatórios financeiros</h1>;
}

const root = document.getElementById('app');
if (root) render(<App />, root);
