export type FeedbackType = "bug" | "enhancement";

export type FeedbackStatus = "open" | "closed";

export type DiscordDeliveryStatus = "pending" | "sent" | "failed";

export interface CreateFeedbackInput {
   type: FeedbackType;
   title: string;
   description: string;
   url: string;
   logrocketSessionId?: string | null;
}

export interface FeedbackRecord {
   id: string;
   feedbackNumber: number;
   type: FeedbackType;
   title: string;
   description: string;
   url: string;
   status: FeedbackStatus;
   logrocketSessionId?: string | null;
   discordStatus: DiscordDeliveryStatus;
   discordMessageId?: string | null;
   discordChannelId?: string | null;
   userId?: string | null;
   createdAt: Date;
   updatedAt: Date;
}

export interface CreateFeedbackResult {
   id: string;
   feedbackNumber: number;
   code: string;
   status: FeedbackStatus;
   discordStatus: DiscordDeliveryStatus;
}
