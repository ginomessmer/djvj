import type { ComponentChildren } from 'preact';

interface DisclosureProps {
  title: string;
  /** One line shown next to the title while collapsed. */
  summary?: string;
  /** Unfolded when the window opens; the person can still fold it. */
  defaultOpen?: boolean;
  children: ComponentChildren;
}

/** A foldable inspector section for settings that are set once and then left alone. */
export function Disclosure({ title, summary, defaultOpen, children }: DisclosureProps) {
  return (
    <details class="panel panel--fold" open={defaultOpen}>
      <summary class="panel__header panel__summary">
        <span class="panel__chevron" aria-hidden="true" />
        <span class="panel__title">{title}</span>
        {summary && <span class="panel__hint">{summary}</span>}
      </summary>
      <div class="panel__body">{children}</div>
    </details>
  );
}
