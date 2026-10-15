import React from "react";
import Link from "next/link";
import { CoinsIcon } from "./coins-icon";

export interface HeaderCoinBadgeProps {
   coins?: number | null;
   className?: string;
}

export function HeaderCoinBadge({
   coins,
   className = "",
}: HeaderCoinBadgeProps) {
   if (coins === undefined || coins === null) {
      return null;
   }

   return (
      <Link
         href="/wallet"
         title={`Virtual Wallet: ${coins.toLocaleString()} available coins`}
         data-testid="header-coin-badge"
         className={`flex items-center gap-1.5 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 px-2.5 py-1 text-xs font-semibold text-[#f59e0b] transition-colors shrink-0 group ${className}`}
      >
         <CoinsIcon className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
         <span className="tabular-nums">{coins.toLocaleString()}</span>
         <span className="hidden md:inline text-[10px] opacity-80 font-normal">
            coins
         </span>
      </Link>
   );
}
