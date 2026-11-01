import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

interface PanelProps {
  title: string;
  /** Controls in the header strip, right-aligned (a switch, a small button). */
  actions?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}

/** A docked panel: a slim title strip over its content, separated from neighbours by a hairline. */
export function Panel({ title, actions, class: className, children }: PanelProps) {
  const titleId = useId();
  return (
    <section class={className ? `panel ${className}` : 'panel'} aria-labelledby={titleId}>
      <header class="panel__header">
        <h2 class="panel__title" id={titleId}>
          {title}
        </h2>
        {actions}
      </header>
      <div class="panel__body">{children}</div>
    </section>
  );
}
