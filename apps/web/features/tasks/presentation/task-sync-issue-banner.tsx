"use client";

import { useCallback, useEffect, useState } from "react";
import {
   discardDeadLetterMutation,
   getDeadLetterMutations,
   retryDeadLetterMutation,
} from "@/features/tasks/data/local/task-idb";
import {
   scheduleSync,
   TASKS_DEAD_LETTER_EVENT,
} from "@/features/tasks/data/local/task-sync.service";
import type { DeadLetterMutation } from "@/features/tasks/domain/task-sync.types";

export function TaskSyncIssueBanner({ userId }: { userId?: string | null }) {
   const [items, setItems] = useState<DeadLetterMutation[]>([]);

   const refresh = useCallback(async () => {
      if (!userId) {
         setItems([]);
         return;
      }
      const next = await getDeadLetterMutations(userId).catch(() => []);
      setItems(next);
   }, [userId]);

   useEffect(() => {
      void refresh();
      const handle = () => void refresh();
      window.addEventListener(TASKS_DEAD_LETTER_EVENT, handle);
      return () => {
         window.removeEventListener(TASKS_DEAD_LETTER_EVENT, handle);
      };
   }, [refresh]);

   if (!userId || items.length === 0) {
      return null;
   }

   const handleRetry = async (id: string) => {
      await retryDeadLetterMutation(id).catch(() => {});
      scheduleSync(userId, 0);
      await refresh();
   };

   const handleDiscard = async (id: string) => {
      await discardDeadLetterMutation(id).catch(() => {});
      await refresh();
   };

   return (
      <div
         role="alert"
         className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
         <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
               {items.length} change{items.length === 1 ? "" : "s"}{" "}
               couldn&apos;t sync.
            </p>
            <span className="text-xs text-amber-200/80">
               Retry after the server recovers, or discard the local change.
            </span>
         </div>
         <ul className="mt-2 space-y-1.5">
            {items.map((item) => (
               <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-1.5"
               >
                  <span className="text-xs text-amber-100/90">
                     {item.entityType.toLowerCase()} ·{" "}
                     {item.action.toLowerCase()}
                     {item.lastError ? ` · ${item.lastError}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        onClick={() => void handleRetry(item.id)}
                        className="rounded-md border border-amber-400/40 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-400/10"
                     >
                        Retry
                     </button>
                     <button
                        type="button"
                        onClick={() => void handleDiscard(item.id)}
                        className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-amber-100/80 hover:bg-white/5"
                     >
                        Discard
                     </button>
                  </div>
               </li>
            ))}
         </ul>
      </div>
   );
}
