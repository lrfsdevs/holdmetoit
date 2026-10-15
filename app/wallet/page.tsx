import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/core/auth";
import { AppHeader } from "@/features/auth/presentation/auth-nav";
import {
   getEffectiveAdminState,
   PARTICIPANT_PREVIEW_COOKIE,
} from "@/features/auth/domain/preview-mode";
import { WalletView } from "@/features/economy/presentation/wallet-view";
import { getWalletSummary } from "@/features/economy/data/wallet.repository";
import { findTransactionsByUserId } from "@/features/economy/data/ledger.repository";
import { getUserYptId } from "@/features/ypt/data/ypt.repository";
import { SignInWithDiscordButton } from "@/features/auth/presentation/auth-nav";
import { CoinsIcon } from "@/features/economy/presentation/coins-icon";

export const dynamic = "force-dynamic";

export const metadata = {
   title: "Virtual Wallet — HoldMeToIt",
   description:
      "Manage your virtual coins, view transaction history, and track study rewards.",
};

interface WalletPageProps {
   searchParams?: {
      as?: string;
   };
}

export default async function WalletPage({ searchParams }: WalletPageProps) {
   const session = await auth();
   const cookieStore = await cookies();
   const previewCookie = cookieStore.get(PARTICIPANT_PREVIEW_COOKIE)?.value;

   const { isActualAdmin, isPreviewActive, isAdmin } = getEffectiveAdminState({
      userRole: session?.user?.role,
      previewCookie,
      searchParamAs: searchParams?.as,
   });

   if (!session?.user?.id) {
      return (
         <div className="min-h-screen bg-obsidian-bg text-obsidian-text">
            <AppHeader
               user={null}
               isActualAdmin={false}
               isPreviewActive={false}
               subtitle="Economy"
            />
            <main className="mx-auto max-w-lg px-4 py-20 text-center">
               <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-economy-gold/30 bg-economy-gold/10 text-economy-gold mx-auto mb-4">
                  <CoinsIcon className="h-7 w-7" />
               </div>
               <h1 className="text-xl font-bold font-display text-obsidian-text">
                  Sign In to Access Your Wallet
               </h1>
               <p className="text-xs text-obsidian-textDim mt-2 mb-6 max-w-sm mx-auto">
                  Sign in with Discord to view your available coin balance,
                  track proportional study rewards, and review your ledger
                  transactions.
               </p>
               <SignInWithDiscordButton redirectTo="/wallet" />
            </main>
         </div>
      );
   }

   const userId = session.user.id;
   const [summary, history, yptId] = await Promise.all([
      getWalletSummary(userId),
      findTransactionsByUserId(userId, { page: 1, limit: 20 }),
      getUserYptId(userId),
   ]);

   return (
      <div className="min-h-screen bg-obsidian-bg text-obsidian-text">
         <AppHeader
            user={session.user}
            isActualAdmin={isActualAdmin}
            isPreviewActive={isPreviewActive}
            subtitle="Virtual Economy"
         />
         <main className="mx-auto max-w-5xl px-3 sm:px-6 py-6 sm:py-8">
            <div className="mb-6">
               <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-obsidian-text">
                  Economy & Wallet
               </h1>
               <p className="text-xs text-obsidian-textDim mt-1">
                  Earn virtual coins proportionally for every eligible study
                  second. Spend, reserve, and track all currency activity.
               </p>
            </div>

            <WalletView
               initialSummary={summary}
               initialTransactions={history.transactions as any}
               initialPagination={history.pagination}
               isAdmin={isAdmin}
               userId={userId}
               initialYptId={yptId}
            />
         </main>
      </div>
   );
}
