import { render } from 'preact';
import { App } from './App';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/app.css';

render(<App />, document.getElementById('app')!);
