import type { ComponentChildren } from 'preact';

interface DisclosureProps {
  title: string;
  /** One line shown next to the title while collapsed. */
  summary?: string;
  children: ComponentChildren;
}

/** A collapsible card for settings that are set once and then left alone. */
export function Disclosure({ title, summary, children }: DisclosureProps) {
  return (
    <details class="card disclosure">
      <summary class="disclosure__summary">
        <span class="card__title">{title}</span>
        {summary && <span class="disclosure__hint">{summary}</span>}
      </summary>
      <div class="disclosure__body">{children}</div>
    </details>
  );
}
