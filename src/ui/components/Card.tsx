import type { ComponentChildren } from 'preact';

interface CardProps {
  title: string;
  children: ComponentChildren;
}

export function Card({ title, children }: CardProps) {
  return (
    <section class="card">
      <h2 class="card__title">{title}</h2>
      {children}
    </section>
  );
}
