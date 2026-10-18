import type { ReactNode } from "react";

interface EmptyStateProps {
   title: string;
   description: string;
   action?: ReactNode;
}

/** Renders a reusable empty-state message and optional call to action. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
   return (
      <div
         className="rounded-3xl border border-border-default bg-surface-primary p-8 text-center shadow-lg"
         role="status"
      >
         <p className="text-lg font-bold text-white">{title}</p>
         <p className="mt-2 text-sm leading-relaxed text-text-tertiary">
            {description}
         </p>
         {action ? (
            <div className="mt-6 flex justify-center">{action}</div>
         ) : null}
      </div>
   );
}
