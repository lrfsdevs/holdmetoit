"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RefreshAvatarButtonProps {
   className?: string;
   variant?: "default" | "outline" | "ghost" | "secondary";
   size?: "default" | "sm" | "lg" | "icon";
   userId?: string;
   discordId?: string;
   onSuccess?: (newImageUrl: string) => void;
}

/**
 * Button that allows an authenticated user to sync their current Discord avatar
 * on-demand without needing to log out and log back in.
 */
export function RefreshAvatarButton({
   className,
   variant = "outline",
   size = "sm",
   userId,
   discordId,
   onSuccess,
}: RefreshAvatarButtonProps) {
   const [isPending, startTransition] = useTransition();
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const router = useRouter();

   const handleSync = () => {
      setStatusMessage(null);
      startTransition(async () => {
         try {
            const res = await fetch("/api/users/sync-avatar", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ userId, discordId }),
            });

            const data = (await res.json().catch(() => ({}))) as {
               success?: boolean;
               newImageUrl?: string;
               error?: string;
            };

            if (res.ok && data.success && data.newImageUrl) {
               setStatusMessage("Avatar updated!");
               onSuccess?.(data.newImageUrl);
               router.refresh();
               setTimeout(() => setStatusMessage(null), 3000);
            } else {
               setStatusMessage(data.error || "Failed to sync");
               setTimeout(() => setStatusMessage(null), 4000);
            }
         } catch {
            setStatusMessage("Error syncing avatar");
            setTimeout(() => setStatusMessage(null), 4000);
         }
      });
   };

   return (
      <div className="inline-flex items-center gap-2">
         <Button
            type="button"
            variant={variant}
            size={size}
            onClick={handleSync}
            disabled={isPending}
            className={className}
            title="Sync latest Discord avatar without logging out"
         >
            <RefreshCw
               className={`h-3.5 w-3.5 mr-1.5 ${isPending ? "animate-spin text-feedback-info" : ""}`}
            />
            <span>{isPending ? "Syncing..." : "Sync Avatar"}</span>
         </Button>
         {statusMessage && (
            <span
               className={`text-label font-medium ${
                  statusMessage.includes("updated")
                     ? "text-feedback-success"
                     : "text-feedback-error"
               }`}
            >
               {statusMessage}
            </span>
         )}
      </div>
   );
}
