interface ErrorStateProps {
   title: string;
   message: string;
}

/** Renders a reusable error message with an optional recovery action. */
export function ErrorState({ title, message }: ErrorStateProps) {
   return (
      <div
         className="rounded-3xl border border-feedback-error/30 bg-feedback-error-bg/30 p-6 text-center"
         role="alert"
      >
         <p className="text-base font-bold text-feedback-error-text">{title}</p>
         <p className="mt-2 text-sm text-text-secondary">{message}</p>
      </div>
   );
}
