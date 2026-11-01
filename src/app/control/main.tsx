import { render } from 'preact';
import { installNativeShell } from '@/services/native-shell';
import { loadPreferences } from '@/services/ui-preferences-storage';
import '@/ui/styles/themes.css';
import '@/ui/styles/base.css';
import '@/ui/styles/control.css';
import { requireElement } from '../dom';
import { applyPreferences } from './appearance';
import { ControlApp } from './ControlApp';

document.title = 'djvj control';
document.documentElement.classList.add('is-app');
installNativeShell();
// Before the first paint, so the page never flashes the wrong theme.
applyPreferences(loadPreferences());
render(<ControlApp />, requireElement('root'));
