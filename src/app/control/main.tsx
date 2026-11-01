import { render } from 'preact';
import '@/ui/styles/base.css';
import '@/ui/styles/control.css';
import { requireElement } from '../dom';
import { ControlApp } from './ControlApp';

render(<ControlApp />, requireElement('root'));
