import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

interface CardProps {
  title: string;
  /** Controls in the header, right-aligned (a switch, a small button). */
  actions?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}

export function Card({ title, actions, class: className, children }: CardProps) {
  const titleId = useId();
  return (
    <section class={className ? `card ${className}` : 'card'} aria-labelledby={titleId}>
      <header class="card__header">
        <h2 class="card__title" id={titleId}>
          {title}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
