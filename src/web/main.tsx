// Must stay the first import: zod probes `new Function` when it first loads, and the CSP blocks (and reports) that probe unless jitless is set before then.
import './csp-safe-zod';
import { render } from 'preact';
import { App } from './App';
import { config } from './config';
import { warmUpWhenIdle } from './engine';
import { applyTheme } from './theme';

applyTheme(config.theme);

const root = document.getElementById('app');
if (root) render(<App />, root);
warmUpWhenIdle();
