// Must stay the first import: zod probes `new Function` when it first loads, and the CSP blocks (and reports) that probe unless jitless is set before then.
import './csp-safe-zod';
import { render } from 'preact';
import { loadConfig } from '@/core/config/schema';
import configJson from '../../config/config.json';
import { App } from './App';
import { applyTheme } from './theme';

applyTheme(loadConfig(configJson).theme);

const root = document.getElementById('app');
if (root) render(<App />, root);
