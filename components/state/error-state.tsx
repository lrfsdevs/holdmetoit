interface ErrorStateProps {
   title: string;
   message: string;
}

/** Renders a reusable error message with an optional recovery action. */
export function ErrorState({ title, message }: ErrorStateProps) {
   return (
      <div
         className="rounded-3xl border border-[#ef4444]/30 bg-[#401010]/30 p-6 text-center"
         role="alert"
      >
         <p className="text-base font-bold text-[#ff5757]">{title}</p>
         <p className="mt-2 text-sm text-[#d1d1d1]">{message}</p>
      </div>
   );
}
