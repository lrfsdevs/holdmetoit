import React from "react";

export function CoinsIcon({
   className = "h-4 w-4",
   fill = "currentColor",
}: {
   className?: string;
   fill?: string;
}) {
   return (
      <svg
         role="img"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinecap="round"
         strokeLinejoin="round"
         className={className}
         aria-hidden="true"
      >
         <circle
            cx="8"
            cy="8"
            r="6"
            fill="hsl(var(--economy-gold))"
            fillOpacity="0.15"
            stroke="hsl(var(--economy-gold))"
         />
         <path
            d="M18.09 10.37A6 6 0 1 1 10.34 18"
            stroke="hsl(var(--economy-gold-light))"
            strokeDasharray="2 2"
         />
         <path d="M7 6h2v4H7z" fill="hsl(var(--economy-gold))" stroke="none" />
         <path d="M7 7.5h2" stroke="hsl(var(--background))" strokeWidth="1.5" />
      </svg>
   );
}
