import { currentView } from '@/services/output-window';

/**
 * The only entry point. One page, two views: the control view is the default, the output view
 * is the popup it opens (`/?view=output`). Each loads only the code it needs.
 */
if (currentView() === 'output') {
  void import('./output/main');
} else {
  void import('./control/main');
}
