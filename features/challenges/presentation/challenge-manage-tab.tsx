"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
   AlertTriangle,
   Calendar,
   Check,
   ChevronDown,
   Clock,
   Loader2,
   Lock,
   Play,
   Plus,
   Search,
   Trash2,
   User as UserIcon,
   UserMinus,
   X,
   RotateCcw,
   Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataPagination } from "@/components/ui/data-pagination";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "@/features/leaderboard/domain/leaderboard.types";
import {
   deleteChallengeAction,
   kickoffChallengeAction,
   lockChallengeResultsAction,
   reassignParticipantTeamAction,
   removeChallengeParticipantAction,
   unlockChallengeResultsAction,
   updateChallengeAction,
} from "@/features/challenges/api/challenge-admin.actions";
import { discardChallengeImageUploadAction } from "@/features/challenges/api/punishment-pfp.actions";
import { ChallengeImageInput } from "@/features/challenges/presentation/challenge-image-input";
import {
   AdminHoursOverrideModal,
   type AdminHoursOverrideParticipant,
} from "@/features/study-logs/presentation/admin-hours-override-modal";
import {
   AdminTargetOverrideModal,
   type AdminTargetOverrideParticipant,
} from "@/features/challenges/presentation/admin-target-override-modal";
import {
   getChallengeDayOptions,
   type ChallengeDayOption,
} from "@/features/study-logs/domain/challenge-day";
import { formatSecondsToClock } from "@/features/study-logs/domain/duration";
import {
   formatDateToUtcInputString,
   isUtcDateRangeValid,
   parseUtcInputStringToIso,
} from "@/features/challenges/domain/challenge-date-time";
import { canLockChallenge } from "@/features/challenges/domain/challenge-lifecycle";

interface ChallengeManageTabProps {
   challenge: ChallengeScoreboardViewModel;
   initialRosterSearch?: string;
   initialRosterTeamFilter?: string;
   initialRosterPage?: number;
}

interface TeamFormItem {
   id?: string;
   name: string;
   color: string;
   iconEmoji: string;
   mascotUrl?: string;
}

/** Renders administrator controls for roster, lifecycle, and challenge settings. */
export function ChallengeManageTab({
   challenge,
   initialRosterSearch = "",
   initialRosterTeamFilter = "ALL",
   initialRosterPage = 1,
}: ChallengeManageTabProps) {
   const router = useRouter();
   const [isPending, startTransition] = useTransition();
   const [isDeleting, setIsDeleting] = useState(false);
   const [showDeleteModal, setShowDeleteModal] = useState(false);
   const [reassigningId, setReassigningId] = useState<string | null>(null);
   const [removeTarget, setRemoveTarget] =
      useState<ScoreboardStandingEntry | null>(null);
   const [removeReason, setRemoveReason] = useState("");
   const [isRemoving, setIsRemoving] = useState(false);

   // Admin Hours Override State
   const [overrideParticipant, setOverrideParticipant] =
      useState<AdminHoursOverrideParticipant | null>(null);
   const [overrideInitialDay, setOverrideInitialDay] = useState<number>(1);
   const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

   // Admin Target Override State (FEAT-DECL-04)
   const [targetOverrideParticipant, setTargetOverrideParticipant] =
      useState<AdminTargetOverrideParticipant | null>(null);
   const [isTargetOverrideModalOpen, setIsTargetOverrideModalOpen] =
      useState(false);

   const handleOpenTargetOverride = (participant: ScoreboardStandingEntry) => {
      setTargetOverrideParticipant({
         participantId: participant.participantId,
         userId: participant.userId,
         displayName: participant.displayName,
         username: participant.username,
         image: participant.image,
         teamName: participant.teamName,
         teamColor: participant.teamColor,
         targetSeconds: participant.targetSeconds,
         targetClock: participant.targetClock,
      });
      setIsTargetOverrideModalOpen(true);
   };

   // Participant Roster & Hours Management Pagination State
   const [rosterSearch, setRosterSearch] = useState(() => {
      if (typeof window !== "undefined") {
         const params = new URLSearchParams(window.location.search);
         const searchParam = params.get("search");
         if (searchParam !== null) return searchParam;
      }
      return initialRosterSearch;
   });
   const [rosterTeamFilter, setRosterTeamFilter] = useState(() => {
      if (typeof window !== "undefined") {
         const params = new URLSearchParams(window.location.search);
         const teamParam = params.get("team");
         if (teamParam !== null) return teamParam;
      }
      return initialRosterTeamFilter;
   });
   const [rosterPage, setRosterPage] = useState(() => {
      if (typeof window !== "undefined") {
         const params = new URLSearchParams(window.location.search);
         const pageParam = parseInt(params.get("page") ?? "", 10);
         if (!isNaN(pageParam) && pageParam >= 1) return pageParam;
      }
      return initialRosterPage;
   });
   const rosterPageSize = 8;

   const updateUrlParams = (updates: {
      search?: string;
      team?: string;
      page?: number;
   }) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);

      if ("search" in updates) {
         const q = updates.search?.trim();
         if (q) {
            url.searchParams.set("search", q);
         } else {
            url.searchParams.delete("search");
         }
      }

      if ("team" in updates) {
         const t = updates.team;
         if (t && t !== "ALL") {
            url.searchParams.set("team", t);
         } else {
            url.searchParams.delete("team");
         }
      }

      if ("page" in updates) {
         const p = updates.page;
         if (p && p > 1) {
            url.searchParams.set("page", String(p));
         } else {
            url.searchParams.delete("page");
         }
      }

      window.history.replaceState(
         null,
         "",
         `${url.pathname}${url.search}${url.hash}`
      );
   };

   useEffect(() => {
      const syncFromUrl = () => {
         if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            setRosterSearch(params.get("search") ?? "");
            setRosterTeamFilter(params.get("team") ?? "ALL");
            const parsedPage = parseInt(params.get("page") ?? "1", 10);
            setRosterPage(
               !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1
            );
         }
      };

      window.addEventListener("popstate", syncFromUrl);
      return () => window.removeEventListener("popstate", syncFromUrl);
   }, []);

   const [participantTeamMap, setParticipantTeamMap] = useState<
      Record<string, string>
   >(() => {
      const map: Record<string, string> = {};
      challenge.standings.forEach((p) => {
         map[p.participantId] = p.teamId || "no-assigned";
      });
      return map;
   });

   useEffect(() => {
      setParticipantTeamMap((prev) => {
         const map: Record<string, string> = { ...prev };
         challenge.standings.forEach((p) => {
            if (
               !(p.participantId in map) ||
               map[p.participantId] === "no-assigned"
            ) {
               map[p.participantId] = p.teamId || "no-assigned";
            }
         });
         return map;
      });
   }, [challenge.standings]);

   const [removedParticipantIds, setRemovedParticipantIds] = useState<
      Set<string>
   >(() => new Set());

   const visibleStandings = challenge.standings.filter(
      (p) => !removedParticipantIds.has(p.participantId)
   );

   const filteredRoster = visibleStandings.filter((p) => {
      const q = rosterSearch.toLowerCase().trim();
      if (q) {
         const matches =
            p.displayName.toLowerCase().includes(q) ||
            (p.username && p.username.toLowerCase().includes(q)) ||
            p.teamName.toLowerCase().includes(q);
         if (!matches) return false;
      }

      if (rosterTeamFilter !== "ALL") {
         const currentTeamId =
            participantTeamMap[p.participantId] || p.teamId || "no-assigned";
         if (rosterTeamFilter === "UNASSIGNED") {
            if (currentTeamId !== "no-assigned" && currentTeamId !== "") {
               return false;
            }
         } else {
            const matchedTeam = challenge.teams.find(
               (t) => t.id === rosterTeamFilter
            );
            if (
               currentTeamId !== rosterTeamFilter &&
               (!matchedTeam || p.teamName !== matchedTeam.name)
            ) {
               return false;
            }
         }
      }

      return true;
   });

   const hasActiveRosterFilters =
      rosterSearch.trim() !== "" || rosterTeamFilter !== "ALL";

   const handleResetRosterFilters = () => {
      setRosterSearch("");
      setRosterTeamFilter("ALL");
      setRosterPage(1);
      updateUrlParams({ search: "", team: "ALL", page: 1 });
   };

   const totalRosterPages = Math.ceil(filteredRoster.length / rosterPageSize);
   const safeRosterPage = Math.min(
      Math.max(1, rosterPage),
      Math.max(1, totalRosterPages)
   );
   const paginatedRoster = filteredRoster.slice(
      (safeRosterPage - 1) * rosterPageSize,
      safeRosterPage * rosterPageSize
   );

   const dayOptions: ChallengeDayOption[] = getChallengeDayOptions(
      challenge.startAt,
      new Date(),
      challenge.totalDays || 7
   );

   const handleOpenOverride = (
      participant: ScoreboardStandingEntry,
      dayNum = 1
   ) => {
      setOverrideParticipant({
         participantId: participant.participantId,
         userId: participant.userId,
         displayName: participant.displayName,
         username: participant.username,
         image: participant.image,
         teamName: participant.teamName,
         teamColor: participant.teamColor,
         dailyLogs: participant.dailyLogs,
         totalLoggedSeconds: participant.totalLoggedSeconds,
      });
      setOverrideInitialDay(dayNum);
      setIsOverrideModalOpen(true);
   };

   const [feedback, setFeedback] = useState<{
      type: "success" | "error";
      message: string;
   } | null>(null);

   const [undoLockAvailable, setUndoLockAvailable] = useState(false);
   const undoLockTimerRef = useRef<number | null>(null);

   const clearUndoLockTimer = () => {
      if (undoLockTimerRef.current !== null) {
         window.clearTimeout(undoLockTimerRef.current);
         undoLockTimerRef.current = null;
      }
   };

   useEffect(() => {
      return () => {
         if (undoLockTimerRef.current !== null) {
            window.clearTimeout(undoLockTimerRef.current);
         }
      };
   }, []);

   // Form states
   const [title, setTitle] = useState(challenge.title);
   const [startAt, setStartAt] = useState(() =>
      formatDateToUtcInputString(challenge.startAt)
   );
   const [endAt, setEndAt] = useState(() =>
      formatDateToUtcInputString(challenge.endAt)
   );
   // Preserve raw saved values rather than normalized images or display-only fallbacks.
   const [savedImages, setSavedImages] = useState({
      eventBannerUrl: challenge.eventBannerUrl,
      punishmentPfpUrl: challenge.punishmentPfpUrl,
   });
   const [eventBannerUrl, setEventBannerUrl] = useState<string | null>(
      challenge.eventBannerUrl
   );
   const [punishmentPfpUrl, setPunishmentPfpUrl] = useState<string | null>(
      challenge.punishmentPfpUrl
   );
   const [isBannerUploading, setIsBannerUploading] = useState(false);
   const [isPfpUploading, setIsPfpUploading] = useState(false);
   const [imageInputVersion, setImageInputVersion] = useState(0);
   const [isSaving, setIsSaving] = useState(false);
   const isUploading = isBannerUploading || isPfpUploading;
   const isBusy =
      isPending || isSaving || isUploading || isDeleting || isRemoving;

   useEffect(() => {
      setSavedImages({
         eventBannerUrl: challenge.eventBannerUrl,
         punishmentPfpUrl: challenge.punishmentPfpUrl,
      });
      setEventBannerUrl(challenge.eventBannerUrl);
      setPunishmentPfpUrl(challenge.punishmentPfpUrl);
   }, [challenge.id, challenge.eventBannerUrl, challenge.punishmentPfpUrl]);

   const [teams, setTeams] = useState<TeamFormItem[]>(() =>
      challenge.teams
         .filter((t: any) => !t.isDeleted)
         .map((t) => ({
            id: t.id,
            name: t.name,
            color: t.color || "#FFB066",
            iconEmoji: t.iconEmoji || "🐝",
            mascotUrl: t.mascotUrl || "",
         }))
   );

   const handleReset = () => {
      if (isBusy) return;
      setTitle(challenge.title);
      setStartAt(formatDateToUtcInputString(challenge.startAt));
      setEndAt(formatDateToUtcInputString(challenge.endAt));
      const persistedUrls = new Set([
         savedImages.eventBannerUrl,
         savedImages.punishmentPfpUrl,
      ]);
      for (const url of Array.from(
         new Set([eventBannerUrl, punishmentPfpUrl])
      )) {
         if (url && !persistedUrls.has(url)) {
            void discardChallengeImageUploadAction(url).catch(() => {});
         }
      }
      setEventBannerUrl(savedImages.eventBannerUrl);
      setPunishmentPfpUrl(savedImages.punishmentPfpUrl);
      setImageInputVersion((version) => version + 1);
      setTeams(
         challenge.teams
            .filter((t: any) => !t.isDeleted)
            .map((t) => ({
               id: t.id,
               name: t.name,
               color: t.color || "#FFB066",
               iconEmoji: t.iconEmoji || "🐝",
               mascotUrl: t.mascotUrl || "",
            }))
      );
      const map: Record<string, string> = {};
      for (const s of challenge.standings) {
         map[s.participantId] = s.teamId;
      }
      setParticipantTeamMap(map);
      setFeedback(null);
   };

   const handleAddTeam = () => {
      const defaultEmojis = ["🐝", "🦋", "🦁", "🐺", "🦅", "🦉", "⚡", "🔥"];
      const nextEmoji = defaultEmojis[teams.length % defaultEmojis.length];
      const defaultColors = [
         "#FFB066",
         "#A29DAE",
         "#60A5FA",
         "#34D399",
         "#F472B6",
      ];
      const nextColor = defaultColors[teams.length % defaultColors.length];

      setTeams((prev) => [
         ...prev,
         {
            name: `Team ${prev.length + 1}`,
            color: nextColor,
            iconEmoji: nextEmoji,
         },
      ]);
   };

   const handleRemoveTeam = (index: number) => {
      if (teams.length <= 2) {
         setFeedback({
            type: "error",
            message: "A challenge must have at least 2 teams.",
         });
         return;
      }
      const teamToRemove = teams[index];
      const hasParticipants = challenge.standings.some(
         (s) => s.teamId === teamToRemove.id
      );
      if (hasParticipants) {
         setFeedback({
            type: "error",
            message: `Cannot remove "${teamToRemove.name}" because participants are assigned to it. Reassign them first.`,
         });
         return;
      }
      setTeams((prev) => prev.filter((_, i) => i !== index));
   };

   const handleUpdateTeam = (
      index: number,
      field: keyof TeamFormItem,
      value: string
   ) => {
      setTeams((prev) => {
         const updated = [...prev];
         updated[index] = { ...updated[index], [field]: value };
         return updated;
      });
   };

   const handleSaveChallenge = () => {
      if (isBusy) return;
      setFeedback(null);
      if (!title.trim()) {
         setFeedback({
            type: "error",
            message: "Challenge title cannot be empty.",
         });
         return;
      }
      if (!startAt || !endAt) {
         setFeedback({
            type: "error",
            message: "Both start and end dates are required.",
         });
         return;
      }
      if (!isUtcDateRangeValid(startAt, endAt)) {
         setFeedback({
            type: "error",
            message: "End date must be strictly after the start date.",
         });
         return;
      }
      // Preserve legacy null, empty and whitespace image values exactly on unrelated edits.
      setIsSaving(true);
      startTransition(async () => {
         try {
            const res = await updateChallengeAction({
               challengeId: challenge.id,
               title: title.trim(),
               startAt: parseUtcInputStringToIso(startAt),
               endAt: parseUtcInputStringToIso(endAt),
               eventBannerUrl,
               punishmentPfpUrl,
               teams: teams.map((t) => ({
                  id: t.id,
                  name: t.name.trim(),
                  color: t.color,
                  iconEmoji: t.iconEmoji,
                  mascotUrl: t.mascotUrl,
               })),
            });

            if (res.ok) {
               // Mark both uploads saved immediately, before refresh returns new props.
               setSavedImages({ eventBannerUrl, punishmentPfpUrl });
               setFeedback({
                  type: "success",
                  message:
                     "Challenge details and house identities updated successfully.",
               });
               router.refresh();
            } else {
               setFeedback({ type: "error", message: res.message });
            }
         } catch {
            setFeedback({
               type: "error",
               message: "Could not update the challenge. Please try again.",
            });
         } finally {
            setIsSaving(false);
         }
      });
   };

   const handleReassign = async (participantId: string, newTeamId: string) => {
      if (participantTeamMap[participantId] === newTeamId) return;

      setReassigningId(participantId);
      setFeedback(null);

      const res = await reassignParticipantTeamAction({
         challengeId: challenge.id,
         participantId,
         newTeamId,
      });

      setReassigningId(null);

      if (res.ok) {
         setParticipantTeamMap((prev) => ({
            ...prev,
            [participantId]: newTeamId,
         }));
         setFeedback({
            type: "success",
            message: "Participant moved to new house successfully.",
         });
         router.refresh();
      } else {
         setFeedback({ type: "error", message: res.message });
      }
   };

   const handleRemoveParticipant = async () => {
      if (!removeTarget) return;

      if (removeReason.trim().length < 3) {
         setFeedback({
            type: "error",
            message: "Please provide an audit reason of at least 3 characters.",
         });
         return;
      }

      setIsRemoving(true);
      setFeedback(null);

      const res = await removeChallengeParticipantAction({
         challengeId: challenge.id,
         participantId: removeTarget.participantId,
         reason: removeReason.trim(),
      });

      setIsRemoving(false);

      if (res.ok) {
         setRemovedParticipantIds((prev) => {
            const next = new Set(prev);
            next.add(removeTarget.participantId);
            return next;
         });
         setFeedback({
            type: "success",
            message: `${removeTarget.displayName} has been removed from the challenge.`,
         });
         setRemoveTarget(null);
         setRemoveReason("");
      } else {
         setFeedback({ type: "error", message: res.message });
      }
   };

   const handleKickoff = () => {
      startTransition(async () => {
         const res = await kickoffChallengeAction(challenge.id);
         if (res.ok) {
            setFeedback({
               type: "success",
               message:
                  "Event started! Declarations are now permanently locked.",
            });
            router.refresh();
         } else {
            setFeedback({ type: "error", message: res.message });
         }
      });
   };

   const handleLockResults = () => {
      startTransition(async () => {
         const res = await lockChallengeResultsAction(challenge.id);
         if (res.ok) {
            setFeedback({
               type: "success",
               message:
                  "Event finalized and locked. Three-condition punishment evaluation complete.",
            });
            clearUndoLockTimer();
            setUndoLockAvailable(true);
            undoLockTimerRef.current = window.setTimeout(() => {
               setUndoLockAvailable(false);
               undoLockTimerRef.current = null;
            }, 10_000);
            router.refresh();
         } else {
            setFeedback({ type: "error", message: res.message });
         }
      });
   };

   const handleUndoLockResults = () => {
      startTransition(async () => {
         const res = await unlockChallengeResultsAction(challenge.id);
         if (res.ok) {
            clearUndoLockTimer();
            setUndoLockAvailable(false);
            setFeedback({
               type: "success",
               message: "Results unlocked — the finalization was reverted.",
            });
            router.refresh();
         } else {
            setFeedback({ type: "error", message: res.message });
         }
      });
   };

   const handleDeleteChallenge = async () => {
      setIsDeleting(true);
      setFeedback(null);

      const res = await deleteChallengeAction(challenge.id);

      if (res.ok) {
         setShowDeleteModal(false);
         router.push("/challenges");
      } else {
         setIsDeleting(false);
         setShowDeleteModal(false);
         setFeedback({ type: "error", message: res.message });
      }
   };

   return (
      <div className="space-y-10 max-w-4xl mx-auto pb-16">
         {/* Feedback Banner */}
         {feedback && (
            <div
               className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-medium border ${
                  feedback.type === "success"
                     ? "bg-[#144520]/40 border-[#22c55e]/40 text-[#4ade80]"
                     : "bg-[#450a0a]/40 border-[#ef4444]/40 text-[#f87171]"
               }`}
            >
               {feedback.type === "success" ? (
                  <Check className="h-4 w-4 shrink-0" />
               ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
               )}
               <span>{feedback.message}</span>
               {feedback.type === "success" && undoLockAvailable && (
                  <button
                     type="button"
                     onClick={handleUndoLockResults}
                     disabled={isPending}
                     className="ml-auto shrink-0 rounded-lg border border-[#4ade80]/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#4ade80] transition hover:bg-[#22c55e]/10 disabled:opacity-50"
                  >
                     Undo
                  </button>
               )}
            </div>
         )}

         {/* Main Container matching Figma Obsidian Frame */}
         <div className="rounded-3xl border border-[#262626] bg-[#141414] p-4 sm:p-6 lg:p-8 space-y-8 shadow-xl">
            {/* Event Lifecycle Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
               <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#868686]">
                     Lifecycle Status
                  </span>
                  <div className="flex items-center gap-2">
                     <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                           challenge.status === "ACTIVE"
                              ? "bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/30"
                              : challenge.status === "COMPLETED"
                                ? "bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30"
                                : "bg-[#eab308]/20 text-[#facc15] border border-[#eab308]/30"
                        }`}
                     >
                        ● {challenge.status}
                     </span>
                     <span className="text-xs text-[#868686]">
                        Format: {challenge.format.replace(/_/g, " ")}
                     </span>
                  </div>
               </div>

               <div className="flex items-center gap-2 w-full sm:w-auto">
                  {challenge.status === "UPCOMING" && (
                     <Button
                        type="button"
                        onClick={handleKickoff}
                        disabled={isPending}
                        className="h-10 px-4 w-full sm:w-auto rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-semibold text-xs gap-2"
                     >
                        {isPending ? (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                           <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        Start Event Now
                     </Button>
                  )}

                  {canLockChallenge(
                     challenge.status,
                     challenge.resultsLockedAt
                  ) && (
                     <Button
                        type="button"
                        onClick={handleLockResults}
                        disabled={isPending}
                        className="h-10 px-4 w-full sm:w-auto rounded-xl bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold text-xs gap-2"
                     >
                        {isPending ? (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                           <Lock className="h-3.5 w-3.5" />
                        )}
                        Lock Final Results
                     </Button>
                  )}

                  {Boolean(challenge.resultsLockedAt) && (
                     <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#262626] border border-[#383838] text-xs text-[#a3a3a3]">
                        <Lock className="h-3.5 w-3.5 text-[#eab308]" />
                        <span>Results Locked</span>
                     </div>
                  )}
               </div>
            </div>

            {/* SECTION 1: CHALLENGE DETAILS & TIMETABLE */}
            <section className="space-y-5">
               <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#ffffff]">
                  Challenge Details & Timetable
               </h3>

               <div className="space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-[#a3a3a3]">
                        Challenge Title
                     </label>
                     <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Midterm Reading Week Sprint"
                        className="h-12 rounded-2xl bg-[#292929] border-[#383838] focus:border-[#545454] text-white px-4 text-sm"
                     />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[#a3a3a3] flex items-center justify-between">
                           <span>Start Date & Time (UTC)</span>
                           <Calendar className="h-3.5 w-3.5 text-[#868686]" />
                        </label>
                        <div className="relative">
                           <Input
                              type="datetime-local"
                              value={startAt}
                              onChange={(e) => setStartAt(e.target.value)}
                              className="h-12 rounded-2xl bg-[#292929] border-[#383838] focus:border-[#545454] text-white px-4 text-xs"
                           />
                        </div>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[#a3a3a3] flex items-center justify-between">
                           <span>End Date & Time (UTC)</span>
                           <Calendar className="h-3.5 w-3.5 text-[#868686]" />
                        </label>
                        <div className="relative">
                           <Input
                              type="datetime-local"
                              value={endAt}
                              onChange={(e) => setEndAt(e.target.value)}
                              className="h-12 rounded-2xl bg-[#292929] border-[#383838] focus:border-[#545454] text-white px-4 text-xs"
                           />
                        </div>
                     </div>
                  </div>
               </div>
            </section>

            {/* SECTION 2: DYNAMIC HOUSE / TEAM IDENTITIES */}
            <section className="space-y-5 pt-4 border-t border-[#262626]">
               <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#ffffff]">
                     Dynamic House / Team Identities
                  </h3>
                  <span className="text-[11px] text-[#868686]">
                     {teams.length} Teams Configured
                  </span>
               </div>

               <div className="space-y-3">
                  {teams.map((team, idx) => (
                     <div
                        key={team.id || `team-${idx}`}
                        className="flex items-center gap-2 sm:gap-3 min-w-0"
                     >
                        {/* Emoji Avatar Box */}
                        <div className="relative h-12 w-12 rounded-2xl bg-[#292929] border border-[#383838] flex items-center justify-center shrink-0">
                           <input
                              type="text"
                              value={team.iconEmoji}
                              onChange={(e) =>
                                 handleUpdateTeam(
                                    idx,
                                    "iconEmoji",
                                    e.target.value.slice(0, 2)
                                 )
                              }
                              className="w-full text-center bg-transparent border-0 text-xl focus:outline-none cursor-pointer"
                              title="Change House Emoji"
                           />
                        </div>

                        {/* Team Name Input */}
                        <div className="flex-1 min-w-0">
                           <Input
                              value={team.name}
                              onChange={(e) =>
                                 handleUpdateTeam(idx, "name", e.target.value)
                              }
                              placeholder="Team Name"
                              className="h-12 rounded-2xl bg-[#292929] border-[#383838] focus:border-[#545454] text-white px-3 sm:px-4 text-sm min-w-0"
                           />
                        </div>

                        {/* Color Swatch Badge */}
                        <label className="relative h-12 px-2.5 sm:px-3 rounded-2xl bg-[#292929] border border-[#383838] flex items-center gap-2 cursor-pointer shrink-0 hover:bg-[#333333] transition-colors">
                           <span
                              className="h-5 w-5 rounded-md border border-white/20 shrink-0"
                              style={{
                                 backgroundColor: team.color || "#FFB066",
                              }}
                           />
                           <span className="hidden sm:inline text-xs font-sans text-[#d1d1d1] uppercase select-none">
                              {team.color || "#FFB066"}
                           </span>
                           <input
                              type="color"
                              value={team.color || "#FFB066"}
                              onChange={(e) =>
                                 handleUpdateTeam(idx, "color", e.target.value)
                              }
                              className="sr-only"
                           />
                        </label>

                        {/* Delete Team Button */}
                        {teams.length > 2 && (
                           <button
                              type="button"
                              onClick={() => handleRemoveTeam(idx)}
                              className="h-12 w-12 rounded-2xl border border-transparent hover:border-[#383838] hover:bg-[#292929] text-[#868686] hover:text-[#ef4444] flex items-center justify-center transition-colors shrink-0"
                              title="Remove Team"
                           >
                              <Trash2 className="h-4 w-4" />
                           </button>
                        )}
                     </div>
                  ))}
               </div>

               <button
                  type="button"
                  onClick={handleAddTeam}
                  className="flex items-center gap-2 text-xs font-semibold text-[#ffffff] hover:text-[#e0e0e0] transition-colors pt-1"
               >
                  <Plus className="h-4 w-4" />
                  <span>Add Another Team</span>
               </button>
            </section>

            <section className="space-y-5 pt-4 border-t border-[#262626]">
               <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#ffffff]">
                  Event Header Image
               </h3>
               <ChallengeImageInput
                  key={`event-banner-${imageInputVersion}`}
                  purpose="event-banner"
                  value={eventBannerUrl}
                  savedValue={savedImages.eventBannerUrl}
                  onChange={setEventBannerUrl}
                  onBusyChange={setIsBannerUploading}
                  disabled={isPending || isSaving || isDeleting}
               />
            </section>

            <section className="space-y-5 pt-4 border-t border-[#262626]">
               <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#ffffff]">
                  Assigned Punishment PFP
               </h3>
               <ChallengeImageInput
                  key={`punishment-pfp-${imageInputVersion}`}
                  purpose="punishment-pfp"
                  value={punishmentPfpUrl}
                  savedValue={savedImages.punishmentPfpUrl}
                  onChange={setPunishmentPfpUrl}
                  onBusyChange={setIsPfpUploading}
                  disabled={isPending || isSaving || isDeleting}
               />
            </section>

            {/* SECTION 4: PARTICIPANT ROSTERS & HOURS MANAGEMENT (ADMIN OVERRIDE) */}
            <section className="space-y-5 pt-4 border-t border-[#262626]">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                     <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#ffffff]">
                        Participant Rosters & Study Hours Management
                     </h3>
                     <p className="text-xs text-[#868686]">
                        Reassign houses or override participant logged hours
                        throughout the challenge week (D1–D7). All manual
                        adjustments require an audit reason.
                     </p>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#1c1c1c] border border-[#292929] text-[#868686] self-start sm:self-auto">
                     {filteredRoster.length} of {visibleStandings.length}{" "}
                     scholars
                  </span>
               </div>

               {challenge.standings.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                     {/* Search bar */}
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#868686]" />
                        <Input
                           type="text"
                           placeholder="Search roster by name, @handle, team..."
                           value={rosterSearch}
                           onChange={(e) => {
                              const val = e.target.value;
                              setRosterSearch(val);
                              setRosterPage(1);
                              updateUrlParams({ search: val, page: 1 });
                           }}
                           className="h-8 pl-8 pr-7 bg-[#242424] border-[#383838] text-[#ffffff] placeholder-[#868686] text-xs rounded-xl"
                        />
                        {rosterSearch && (
                           <button
                              type="button"
                              onClick={() => {
                                 setRosterSearch("");
                                 setRosterPage(1);
                                 updateUrlParams({ search: "", page: 1 });
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#868686] hover:text-white p-0.5"
                           >
                              <X className="h-3 w-3" />
                           </button>
                        )}
                     </div>

                     {/* Team Filter Dropdown (View by Team) */}
                     <div className="relative w-full sm:w-56 shrink-0">
                        <select
                           value={rosterTeamFilter}
                           onChange={(e) => {
                              const val = e.target.value;
                              setRosterTeamFilter(val);
                              setRosterPage(1);
                              updateUrlParams({ team: val, page: 1 });
                           }}
                           className="h-8 w-full rounded-xl border border-[#383838] bg-[#242424] px-3 pr-8 text-xs text-[#ffffff] focus:border-[#ffffff]/60 focus:outline-none appearance-none cursor-pointer"
                        >
                           <option value="ALL">
                              All Houses ({visibleStandings.length})
                           </option>
                           {teams.map((t) => (
                              <option
                                 key={t.id || t.name}
                                 value={t.id || t.name}
                              >
                                 {t.iconEmoji ? `${t.iconEmoji} ` : ""}
                                 {t.name}
                              </option>
                           ))}
                           <option value="UNASSIGNED">
                              Unassigned Scholars
                           </option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#868686] pointer-events-none" />
                     </div>

                     {hasActiveRosterFilters && (
                        <Button
                           type="button"
                           variant="outline"
                           size="sm"
                           onClick={handleResetRosterFilters}
                           className="h-8 px-2.5 text-xs rounded-xl border-[#383838] bg-[#1c1c1c] hover:bg-[#292929] text-[#d1d1d1] shrink-0"
                           title="Clear roster filters"
                        >
                           <RotateCcw className="h-3 w-3 mr-1" />
                           Reset
                        </Button>
                     )}
                  </div>
               )}

               {visibleStandings.length === 0 ? (
                  <div className="rounded-2xl border border-[#262626] bg-[#1c1c1c] p-6 text-center text-xs text-[#868686]">
                     No scholars have enrolled in this challenge yet.
                  </div>
               ) : filteredRoster.length === 0 ? (
                  <div className="rounded-2xl border border-[#262626] bg-[#1c1c1c] p-6 text-center space-y-2">
                     <p className="text-xs text-[#868686]">
                        No scholars match your roster search or team filter.
                     </p>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetRosterFilters}
                        className="h-7 px-3 text-[11px] rounded-lg border-[#383838] bg-[#242424] hover:bg-[#333333] text-white"
                     >
                        Reset filters
                     </Button>
                  </div>
               ) : (
                  <div className="space-y-3 rounded-2xl border border-[#262626] bg-[#1a1a1a] p-3 sm:p-4">
                     {paginatedRoster.map((participant) => {
                        const currentSelectedTeamId =
                           participantTeamMap[participant.participantId] ||
                           participant.teamId ||
                           "no-assigned";
                        const isReassigning =
                           reassigningId === participant.participantId;

                        return (
                           <div
                              key={participant.participantId}
                              className="p-3 sm:p-4 rounded-2xl bg-[#1c1c1c] border border-[#262626] space-y-3 hover:border-[#383838] transition-colors"
                           >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                 {/* User info */}
                                 <div className="flex items-center gap-3 min-w-0">
                                    <Link
                                       href={`/challenge/${challenge.id}/participant/${participant.participantId}`}
                                       className="h-10 w-10 rounded-full bg-[#292929] border border-[#383838] overflow-hidden shrink-0 flex items-center justify-center hover:border-[#22c55e] transition-colors"
                                    >
                                       {participant.image ? (
                                          <Image
                                             src={participant.image}
                                             alt={participant.displayName}
                                             width={40}
                                             height={40}
                                             className="h-full w-full object-cover"
                                             unoptimized
                                          />
                                       ) : (
                                          <UserIcon className="h-5 w-5 text-[#868686]" />
                                       )}
                                    </Link>
                                    <div className="min-w-0">
                                       <Link
                                          href={`/challenge/${challenge.id}/participant/${participant.participantId}`}
                                          className="text-xs font-bold text-[#ffffff] hover:text-[#22c55e] hover:underline truncate block"
                                       >
                                          {participant.displayName}
                                       </Link>
                                       <p className="text-[11px] text-[#868686] truncate">
                                          @{participant.username || "scholar"} •{" "}
                                          <span className="text-[#d1d1d1] font-mono">
                                             {participant.totalLoggedClock}
                                          </span>{" "}
                                          logged /{" "}
                                          <span className="text-[#c084fc] font-mono font-semibold">
                                             {participant.targetClock}
                                          </span>{" "}
                                          target
                                       </p>
                                    </div>
                                 </div>

                                 {/* Controls: House Select & Override Buttons */}
                                 <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
                                    {/* Team Selector Dropdown */}
                                    <div className="relative flex-1 sm:flex-initial w-full sm:w-auto">
                                       <select
                                          value={currentSelectedTeamId}
                                          onChange={(e) =>
                                             handleReassign(
                                                participant.participantId,
                                                e.target.value
                                             )
                                          }
                                          disabled={isReassigning}
                                          className="h-9 w-full sm:w-auto pl-3 pr-8 rounded-xl bg-[#292929] border border-[#383838] focus:border-[#545454] text-xs font-semibold text-[#ffffff] appearance-none cursor-pointer focus:outline-none disabled:opacity-50"
                                       >
                                          <option
                                             value="no-assigned"
                                             className="bg-[#1c1c1c] text-[#868686]"
                                          >
                                             ⏳ Not Assigned
                                          </option>
                                          {teams.map((t) => (
                                             <option
                                                key={t.id || t.name}
                                                value={t.id}
                                                className="bg-[#1c1c1c] text-white"
                                             >
                                                {t.iconEmoji || "🛡️"} {t.name}
                                             </option>
                                          ))}
                                       </select>
                                       <ChevronDown className="h-3.5 w-3.5 text-[#868686] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>

                                    {/* Override Hours Button */}
                                    <Button
                                       type="button"
                                       variant="outline"
                                       onClick={() =>
                                          handleOpenOverride(
                                             participant,
                                             dayOptions.find((d) => d.isToday)
                                                ?.dayNumber ??
                                                [...dayOptions]
                                                   .reverse()
                                                   .find((d) => !d.isFuture)
                                                   ?.dayNumber ??
                                                1
                                          )
                                       }
                                       className="h-9 px-3 rounded-xl border-[#383838] bg-[#292929] hover:bg-[#333333] text-white text-xs font-semibold gap-1.5 shrink-0"
                                       title="Admin: Edit Participant Study Hours"
                                    >
                                       <Clock className="h-3.5 w-3.5 text-[#3b82f6]" />
                                       <span>Edit hr</span>
                                    </Button>

                                    {/* Edit Target Hours Button (FEAT-DECL-04) */}
                                    <Button
                                       type="button"
                                       variant="outline"
                                       onClick={() =>
                                          handleOpenTargetOverride(participant)
                                       }
                                       className="h-9 px-3 rounded-xl border-[#383838] bg-[#292929] hover:bg-[#333333] text-white text-xs font-semibold gap-1.5 shrink-0"
                                       title="Admin: Edit Weekly Target Hours"
                                    >
                                       <Target className="h-3.5 w-3.5 text-[#a855f7]" />
                                       <span>Edit target</span>
                                    </Button>

                                    {isReassigning && (
                                       <Loader2 className="h-4 w-4 animate-spin text-[#868686]" />
                                    )}

                                    {challenge.status !== "COMPLETED" && (
                                       <button
                                          type="button"
                                          onClick={() => {
                                             setRemoveTarget(participant);
                                             setRemoveReason("");
                                          }}
                                          disabled={isBusy}
                                          className="h-9 w-9 rounded-xl border border-transparent hover:border-[#383838] hover:bg-[#292929] text-[#868686] hover:text-[#ef4444] flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                                          title="Remove participant from challenge"
                                       >
                                          <UserMinus className="h-4 w-4" />
                                       </button>
                                    )}
                                 </div>
                              </div>

                              {/* 7-Day Week Strip (Clickable to jump to specific day in override modal) */}
                              <div className="pt-2 border-t border-[#262626]">
                                 <div className="flex items-center justify-between text-[10px] text-[#868686] pb-1 px-0.5">
                                    <span>
                                       7-Day Log Breakdown (Click day to edit)
                                    </span>
                                    <span className="text-[#a1a1a1]">
                                       Full Week D1–D7
                                    </span>
                                 </div>
                                 <div className="grid grid-cols-7 gap-1 w-full text-center">
                                    {dayOptions.map((opt) => {
                                       const loggedSec =
                                          participant.dailyLogs?.[
                                             opt.dateKey
                                          ] ?? 0;
                                       const hasHours = loggedSec > 0;
                                       const isFuture = opt.isFuture;
                                       return (
                                          <button
                                             key={opt.dayNumber}
                                             type="button"
                                             disabled={isFuture}
                                             onClick={() =>
                                                handleOpenOverride(
                                                   participant,
                                                   opt.dayNumber
                                                )
                                             }
                                             className={`py-1.5 px-0.5 rounded-lg text-center transition-all ${
                                                isFuture
                                                   ? "bg-[#1c1c1c]/30 border border-transparent text-[#545454] cursor-not-allowed opacity-50"
                                                   : hasHours
                                                     ? "bg-[#144520]/30 hover:bg-[#144520]/60 border border-[#22c55e]/30 text-[#4ade80]"
                                                     : "bg-[#242424]/40 hover:bg-[#2f2f2f] border border-[#2e2e2e] text-[#868686] hover:text-[#d1d1d1]"
                                             }`}
                                             title={
                                                isFuture
                                                   ? `Day ${opt.dayNumber} (${opt.dateKey}) - Future date (cannot edit)`
                                                   : `Click to edit Day ${opt.dayNumber} (${opt.dateKey}) - ${formatSecondsToClock(loggedSec)}`
                                             }
                                          >
                                             <div className="text-[9px] uppercase tracking-wider text-[#a1a1a1] leading-none">
                                                {opt.weekday}
                                             </div>
                                             <div className="text-[10px] font-semibold mt-0.5 leading-none">
                                                D{opt.dayNumber}
                                             </div>
                                             <div className="text-[9px] font-mono mt-1 leading-none truncate">
                                                {isFuture
                                                   ? "-"
                                                   : hasHours
                                                     ? `${Math.floor(loggedSec / 3600)}h`
                                                     : "-"}
                                             </div>
                                          </button>
                                       );
                                    })}
                                 </div>
                              </div>
                           </div>
                        );
                     })}

                     <DataPagination
                        currentPage={safeRosterPage}
                        totalPages={totalRosterPages}
                        totalItems={filteredRoster.length}
                        pageSize={rosterPageSize}
                        onPageChange={(page) => {
                           setRosterPage(page);
                           updateUrlParams({ page });
                        }}
                        itemLabel="scholars"
                     />
                  </div>
               )}
            </section>

            {/* BOTTOM ACTION BAR (Cancel & Save) */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-[#262626]">
               <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isBusy}
                  className="h-11 px-6 w-full sm:w-auto rounded-2xl border-[#383838] bg-[#1c1c1c] text-[#ffffff] hover:bg-[#292929] hover:text-[#ffffff] text-xs font-bold"
               >
                  Cancel
               </Button>

               <Button
                  type="button"
                  onClick={handleSaveChallenge}
                  disabled={isBusy}
                  className="h-11 px-6 w-full sm:w-auto rounded-2xl bg-[#ffffff] text-[#0d0d0d] hover:bg-[#e0e0e0] text-xs font-bold shadow-sm gap-2"
               >
                  {(isPending || isSaving) && (
                     <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save & Update Event
               </Button>
            </div>
         </div>

         {/* SECTION 5: DANGER ZONE (Delete Event) */}
         <div className="rounded-3xl border border-red-900/40 bg-red-950/10 p-4 sm:p-6 lg:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="space-y-1">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                     Danger Zone
                  </h4>
                  <p className="text-xs text-[#a3a3a3] max-w-xl">
                     Permanently delete this event. All associated teams, member
                     study logs, weekly goals, and punishment records will be
                     permanently purged.
                  </p>
               </div>

               <Button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={isBusy}
                  className="h-11 px-5 w-full sm:w-auto rounded-2xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs shrink-0 gap-2"
               >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Event
               </Button>
            </div>
         </div>

         {/* Delete Confirmation Modal */}
         {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
               <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
                  <div className="flex items-center gap-3 text-red-400">
                     <div className="h-10 w-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5" />
                     </div>
                     <h3 className="text-base font-bold text-white">
                        Delete Challenge Event?
                     </h3>
                  </div>

                  <p className="text-xs leading-relaxed text-[#a3a3a3]">
                     Are you sure you want to permanently delete{" "}
                     <strong className="text-white">
                        &quot;{challenge.title}&quot;
                     </strong>
                     ? This action cannot be undone. All study records, team
                     rosters, and historical standings will be erased forever.
                  </p>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                     <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDeleteModal(false)}
                        disabled={isDeleting}
                        className="h-11 px-5 w-full sm:w-auto rounded-2xl border-[#383838] bg-[#1c1c1c] text-white hover:bg-[#292929] text-xs font-semibold"
                     >
                        Cancel
                     </Button>

                     <Button
                        type="button"
                        onClick={handleDeleteChallenge}
                        disabled={isDeleting}
                        className="h-11 px-5 w-full sm:w-auto rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold gap-2"
                     >
                        {isDeleting && (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Yes, Delete Event
                     </Button>
                  </div>
               </div>
            </div>
         )}

         {/* Remove Participant Confirmation Modal */}
         {removeTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
               <div className="bg-[#141414] border border-[#262626] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-6 shadow-2xl">
                  <div className="flex items-center gap-3 text-red-400">
                     <div className="h-10 w-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                        <UserMinus className="h-5 w-5" />
                     </div>
                     <h3 className="text-base font-bold text-white">
                        Remove Participant?
                     </h3>
                  </div>

                  <p className="text-xs leading-relaxed text-[#a3a3a3]">
                     You are about to remove{" "}
                     <strong className="text-white">
                        {removeTarget.displayName}
                     </strong>{" "}
                     from{" "}
                     <strong className="text-white">
                        &quot;{challenge.title}&quot;
                     </strong>
                     . Their study logs, punishment record, and standings entry
                     will be permanently deleted. This action cannot be undone.
                  </p>

                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-[#a3a3a3]">
                        Audit Reason <span className="text-red-400">*</span>
                     </label>
                     <Input
                        value={removeReason}
                        onChange={(e) => setRemoveReason(e.target.value)}
                        placeholder="e.g. Duplicate enrollment, rule violation..."
                        className="h-11 rounded-2xl bg-[#292929] border-[#383838] focus:border-[#545454] text-white px-4 text-xs"
                     />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                     <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                           setRemoveTarget(null);
                           setRemoveReason("");
                        }}
                        disabled={isRemoving}
                        className="h-11 px-5 w-full sm:w-auto rounded-2xl border-[#383838] bg-[#1c1c1c] text-white hover:bg-[#292929] text-xs font-semibold"
                     >
                        Cancel
                     </Button>

                     <Button
                        type="button"
                        onClick={handleRemoveParticipant}
                        disabled={isRemoving}
                        className="h-11 px-5 w-full sm:w-auto rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold gap-2"
                     >
                        {isRemoving && (
                           <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Yes, Remove Participant
                     </Button>
                  </div>
               </div>
            </div>
         )}

         {/* Admin Hours Override Modal (FEAT-LOG-04) */}
         <AdminHoursOverrideModal
            isOpen={isOverrideModalOpen}
            onClose={() => setIsOverrideModalOpen(false)}
            challengeId={challenge.id}
            challengeStartDate={challenge.startAt}
            totalChallengeDays={challenge.totalDays || 7}
            participant={overrideParticipant}
            initialDayNumber={overrideInitialDay}
            onOpenTargetOverride={() => {
               if (overrideParticipant) {
                  const found = challenge.standings.find(
                     (s) =>
                        s.participantId === overrideParticipant.participantId
                  );
                  if (found) {
                     handleOpenTargetOverride(found);
                  }
               }
            }}
         />

         {/* Admin Target Override Modal (FEAT-DECL-04) */}
         <AdminTargetOverrideModal
            isOpen={isTargetOverrideModalOpen}
            onClose={() => {
               setIsTargetOverrideModalOpen(false);
               setTargetOverrideParticipant(null);
            }}
            challengeId={challenge.id}
            participant={targetOverrideParticipant}
            onSuccess={() => {
               startTransition(() => {
                  router.refresh();
               });
            }}
         />
      </div>
   );
}
