import React from 'react';

// A lightly tinted, grouped section for record/intake forms — subtle header,
// soft background so the white inputs read as a set within the group.
interface FormSectionProps {
  title: string;
  children: React.ReactNode;
}
export function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-background/50 p-4 space-y-4">
      <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
        {title}
      </h3>
      {children}
    </section>);

}
