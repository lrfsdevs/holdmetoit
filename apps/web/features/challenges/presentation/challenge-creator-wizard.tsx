"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
   AlertCircle,
   Calendar,
   Plus,
   Users2,
   UserPlus,
   User,
   Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
   captureLogRocketException,
   trackLogRocketEvent,
} from "@/core/observability/logrocket";
import { createChallengeAction } from "@/features/challenges/api/challenge-admin.actions";
import { discardChallengeImageUploadAction } from "@/features/challenges/api/punishment-pfp.actions";
import { ChallengeImageInput } from "@/features/challenges/presentation/challenge-image-input";
import { ChallengeDescriptionEditor } from "@/features/challenges/presentation/challenge-description-editor";
import { DEFAULT_CHALLENGE_DESCRIPTION } from "@/features/challenges/domain/challenge-description";
import {
   formatDateToUtcInputString,
   isUtcDateRangeValid,
   parseUtcInputStringToIso,
} from "@/features/challenges/domain/challenge-date-time";

type Format = "TEAM_VS_TEAM" | "DUOS" | "SOLOS";

interface TeamConfig {
   name: string;
   color: string;
   iconEmoji: string;
   mascotUrl?: string;
}

const PRESET_THEMES: Record<string, { label: string; teams: TeamConfig[] }> = {
   serpentsVsRaven: {
      label: "Team Serpents vs Team Raven",
      teams: [
         {
            name: "Team Serpents",
            color: "#22c55e",
            iconEmoji: "🐍",
         },
         {
            name: "Team Raven",
            color: "#3b82f6",
            iconEmoji: "🦅",
         },
      ],
   },
   emeraldVsSapphire: {
      label: "Emerald Dragons vs Sapphire Phoenix",
      teams: [
         {
            name: "Emerald Dragons",
            color: "#10b981",
            iconEmoji: "🐉",
         },
         {
            name: "Sapphire Phoenix",
            color: "#6366f1",
            iconEmoji: "🔥",
         },
      ],
   },
   shadowVsRadiant: {
      label: "Shadow Knights vs Radiant Vanguard",
      teams: [
         {
            name: "Shadow Knights",
            color: "#8b5cf6",
            iconEmoji: "⚔️",
         },
         {
            name: "Radiant Vanguard",
            color: "#eab308",
            iconEmoji: "🛡️",
         },
      ],
   },
};

/** Renders the multi-step host challenge creation wizard. */
export function ChallengeCreatorWizard() {
   const router = useRouter();
   const [format, setFormat] = useState<Format>("TEAM_VS_TEAM");
   const [title, setTitle] = useState("");
   const [description, setDescription] = useState(
      DEFAULT_CHALLENGE_DESCRIPTION
   );
   const [startAt, setStartAt] = useState(() => {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      return formatDateToUtcInputString(d);
   });
   const [endAt, setEndAt] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setMinutes(0, 0, 0);
      return formatDateToUtcInputString(d);
   });

   const [selectedPreset, setSelectedPreset] =
      useState<string>("serpentsVsRaven");
   const [teams, setTeams] = useState<TeamConfig[]>(
      PRESET_THEMES.serpentsVsRaven.teams
   );
   const [eventBannerUrl, setEventBannerUrl] = useState<string | null>(null);
   const [isBannerUploading, setIsBannerUploading] = useState(false);
   const [bannerError, setBannerError] = useState<string | null>(null);
   const [punishmentPfpUrl, setPunishmentPfpUrl] = useState<string | null>(
      null
   );
   const [isPfpUploading, setIsPfpUploading] = useState(false);
   const [pfpError, setPfpError] = useState<string | null>(null);

   const [errorMsg, setErrorMsg] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();
   const [isCreating, setIsCreating] = useState(false);
   const isUploading = isBannerUploading || isPfpUploading;
   const isSubmitting = isPending || isCreating;

   const handlePresetChange = (presetKey: string) => {
      setSelectedPreset(presetKey);
      if (presetKey in PRESET_THEMES) {
         setTeams(PRESET_THEMES[presetKey].teams);
      }
   };

   const handleFormatChange = (newFormat: Format) => {
      setFormat(newFormat);
      if (newFormat === "SOLOS") {
         setTeams([
            {
               name: "Solo Grinders",
               color: "#3b82f6",
               iconEmoji: "⚡",
            },
         ]);
      } else if (newFormat === "DUOS") {
         setTeams([
            {
               name: "Duo Pair A",
               color: "#22c55e",
               iconEmoji: "⚔️",
            },
            {
               name: "Duo Pair B",
               color: "#3b82f6",
               iconEmoji: "🛡️",
            },
         ]);
      } else {
         setTeams(PRESET_THEMES.serpentsVsRaven.teams);
      }
   };

   const updateTeam = (
      index: number,
      field: keyof TeamConfig,
      value: string
   ) => {
      setTeams((prev) => {
         const copy = [...prev];
         copy[index] = { ...copy[index], [field]: value };
         return copy;
      });
   };

   const addTeam = () => {
      setTeams((prev) => [
         ...prev,
         {
            name: `Team ${prev.length + 1}`,
            color: "#3b82f6",
            iconEmoji: "⭐",
         },
      ]);
   };

   const removeTeam = (index: number) => {
      if (teams.length <= (format === "TEAM_VS_TEAM" ? 2 : 1)) return;
      setTeams((prev) => prev.filter((_, i) => i !== index));
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (isSubmitting || isUploading) return;
      setErrorMsg(null);
      setBannerError(
         eventBannerUrl ? null : "Please upload an event header image."
      );
      setPfpError(null);
      if (!eventBannerUrl) return;

      if (!isUtcDateRangeValid(startAt, endAt)) {
         setErrorMsg("End date must be strictly after the start date.");
         return;
      }

      setIsCreating(true);
      startTransition(async () => {
         try {
            const result = await createChallengeAction({
               title,
               description: description.trim() || undefined,
               format,
               startAt: parseUtcInputStringToIso(startAt),
               endAt: parseUtcInputStringToIso(endAt),
               eventBannerUrl,
               punishmentPfpUrl,
               teams,
            });

            if (result.ok && result.data?.challengeId) {
               trackLogRocketEvent("ChallengeCreated", {
                  challengeId: result.data.challengeId,
                  format,
               });
               router.push(`/challenge/${result.data.challengeId}`);
            } else if (!result.ok) {
               setErrorMsg(result.message);
            }
         } catch (error) {
            captureLogRocketException(error, {
               tags: { action: "create-challenge" },
               extra: { format },
            });
            setErrorMsg("Could not create the challenge. Please try again.");
         } finally {
            setIsCreating(false);
         }
      });
   };

   return (
      <form
         onSubmit={handleSubmit}
         className="max-w-4xl mx-auto space-y-6 bg-surface-page p-6 sm:p-8 rounded-3xl border border-border-default shadow-2xl"
      >
         {/* Step 1: Battle Format (Figma 144:1012 step-1) */}
         <div className="space-y-3">
            <h3 className="text-base font-bold text-white tracking-tight">
               Battle Format
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
               {/* Team vs Team */}
               <button
                  type="button"
                  onClick={() => handleFormatChange("TEAM_VS_TEAM")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                     format === "TEAM_VS_TEAM"
                        ? "border-white bg-surface-primary shadow-md"
                        : "border-border-default bg-surface-primary/60 hover:border-border-strong"
                  }`}
               >
                  <div className="flex items-center gap-2 mb-2">
                     <Users2 className="h-4 w-4 text-white" />
                     <span className="font-semibold text-sm text-text-primary">
                        Team vs Team
                     </span>
                  </div>
                  <span className="text-xs text-text-secondary leading-relaxed">
                     Divide participants into houses. Settle cumulative deficit
                     balances collectively.
                  </span>
               </button>

               {/* Duos Battle */}
               <button
                  type="button"
                  onClick={() => handleFormatChange("DUOS")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                     format === "DUOS"
                        ? "border-white bg-surface-primary shadow-md"
                        : "border-border-default bg-surface-primary/60 hover:border-border-strong"
                  }`}
               >
                  <div className="flex items-center gap-2 mb-2">
                     <UserPlus className="h-4 w-4 text-text-secondary" />
                     <span className="font-semibold text-sm text-text-primary">
                        Duos Battle
                     </span>
                  </div>
                  <span className="text-xs text-text-secondary leading-relaxed">
                     Buddy up. Complete joint schedules. If one partner falters,
                     both earn the forfeit.
                  </span>
               </button>

               {/* Solos FFA */}
               <button
                  type="button"
                  onClick={() => handleFormatChange("SOLOS")}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                     format === "SOLOS"
                        ? "border-white bg-surface-primary shadow-md"
                        : "border-border-default bg-surface-primary/60 hover:border-border-strong"
                  }`}
               >
                  <div className="flex items-center gap-2 mb-2">
                     <User className="h-4 w-4 text-text-secondary" />
                     <span className="font-semibold text-sm text-text-primary">
                        Solos FFA
                     </span>
                  </div>
                  <span className="text-xs text-text-secondary leading-relaxed">
                     Every scholar for themselves. Complete personal targets or
                     face public punishment.
                  </span>
               </button>
            </div>
         </div>

         {/* Step 2: Challenge Details & Timetable (Figma 144:1012 step-2) */}
         <div className="space-y-4 pt-3 border-t border-border-subtle">
            <h3 className="text-base font-bold text-white tracking-tight">
               Challenge Details & Timetable
            </h3>

            <div>
               <Label
                  htmlFor="wizard-challenge-title"
                  className="block text-xs font-medium text-text-primary mb-1.5"
               >
                  Challenge Title
               </Label>
               <Input
                  id="wizard-challenge-title"
                  type="text"
                  placeholder="e.g. Midterm Reading Week Sprint"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={3}
                  maxLength={80}
                  className="h-11 bg-input-bg border-input-border text-text-primary placeholder-text-secondary rounded-xl"
               />
            </div>

            <div>
               <Label
                  htmlFor="wizard-challenge-description"
                  className="block text-xs font-medium text-text-primary mb-1.5"
               >
                  Challenge Description
               </Label>
               <ChallengeDescriptionEditor
                  id="wizard-challenge-description"
                  value={description}
                  onChange={setDescription}
                  disabled={isSubmitting}
               />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div>
                  <Label
                     htmlFor="wizard-start-at"
                     className="block text-xs font-medium text-text-primary mb-1.5 flex items-center gap-1.5"
                  >
                     <Calendar className="h-3.5 w-3.5 text-text-secondary" />
                     <span>Start Date & Time (UTC)</span>
                  </Label>
                  <Input
                     id="wizard-start-at"
                     type="datetime-local"
                     value={startAt}
                     onChange={(e) => setStartAt(e.target.value)}
                     required
                     className="h-11 bg-input-bg border-input-border text-text-primary rounded-xl"
                  />
               </div>
               <div>
                  <Label
                     htmlFor="wizard-end-at"
                     className="block text-xs font-medium text-text-primary mb-1.5 flex items-center gap-1.5"
                  >
                     <Calendar className="h-3.5 w-3.5 text-text-secondary" />
                     <span>End Date & Time (UTC)</span>
                  </Label>
                  <Input
                     id="wizard-end-at"
                     type="datetime-local"
                     value={endAt}
                     onChange={(e) => setEndAt(e.target.value)}
                     required
                     className="h-11 bg-input-bg border-input-border text-text-primary rounded-xl"
                  />
               </div>
            </div>
         </div>

         {/* Step 3: Dynamic House / Team Identities (Figma 144:1012 step-3) */}
         <div className="space-y-4 pt-3 border-t border-border-subtle">
            <h3 className="text-base font-bold text-white tracking-tight">
               Dynamic House / Team Identities
            </h3>

            <div className="space-y-3">
               {teams.map((team, idx) => (
                  <div
                     key={idx}
                     className="flex items-center gap-3 p-2.5 rounded-xl border border-border-default bg-surface-primary"
                  >
                     <div className="w-12 shrink-0">
                        <Input
                           type="text"
                           maxLength={4}
                           value={team.iconEmoji || ""}
                           onChange={(e) =>
                              updateTeam(idx, "iconEmoji", e.target.value)
                           }
                           className="h-10 text-center font-sans bg-input-bg border-input-border text-lg rounded-xl text-white"
                        />
                     </div>

                     <div className="flex-1 min-w-0">
                        <Input
                           type="text"
                           value={team.name}
                           onChange={(e) =>
                              updateTeam(idx, "name", e.target.value)
                           }
                           required
                           placeholder="Team Name"
                           className="h-10 bg-input-bg border-input-border text-text-primary rounded-xl text-xs"
                        />
                     </div>

                     <div className="flex items-center gap-2 bg-input-bg border border-input-border rounded-xl px-2 h-10 shrink-0">
                        <input
                           type="color"
                           value={team.color || "#22c55e"}
                           onChange={(e) =>
                              updateTeam(idx, "color", e.target.value)
                           }
                           className="h-6 w-6 cursor-pointer rounded border-none bg-transparent p-0"
                        />
                        <span className="font-sans text-xs text-text-secondary">
                           {team.color}
                        </span>
                     </div>

                     {format === "TEAM_VS_TEAM" && teams.length > 2 && (
                        <button
                           type="button"
                           onClick={() => removeTeam(idx)}
                           className="text-xs text-feedback-error-text hover:underline px-2"
                        >
                           Remove
                        </button>
                     )}
                  </div>
               ))}

               {format === "TEAM_VS_TEAM" && (
                  <button
                     type="button"
                     onClick={addTeam}
                     className="inline-flex items-center gap-1.5 text-xs text-white hover:text-text-secondary font-medium pt-1"
                  >
                     <Plus className="h-3.5 w-3.5" />
                     <span>Add Another Team</span>
                  </button>
               )}
            </div>
         </div>

         <section className="space-y-4 pt-3 border-t border-border-subtle">
            <h3 className="text-base font-bold text-white tracking-tight">
               Event Header Image{" "}
               <span className="text-feedback-error-text" aria-label="required">
                  *
               </span>
            </h3>
            <ChallengeImageInput
               purpose="event-banner"
               value={eventBannerUrl}
               onChange={(url) => {
                  setEventBannerUrl(url);
                  setBannerError(null);
               }}
               onBusyChange={setIsBannerUploading}
               disabled={isSubmitting}
               error={bannerError}
            />
         </section>

         <section className="space-y-4 pt-3 border-t border-border-subtle">
            <div className="flex items-center gap-2">
               <h3 className="text-base font-bold text-white tracking-tight">
                  Assigned Punishment PFP
               </h3>
               <span className="text-xs font-normal text-text-tertiary">
                  (Optional)
               </span>
            </div>
            <ChallengeImageInput
               purpose="punishment-pfp"
               value={punishmentPfpUrl}
               onChange={(url) => {
                  setPunishmentPfpUrl(url);
                  setPfpError(null);
               }}
               onBusyChange={setIsPfpUploading}
               disabled={isSubmitting}
               error={pfpError}
               allowClear
            />
         </section>

         {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-feedback-error-text/40 bg-feedback-error-bg p-3 text-xs text-feedback-error-text">
               <AlertCircle className="h-4 w-4 shrink-0" />
               <span>{errorMsg}</span>
            </div>
         )}

         {/* Modal Actions */}
         <div className="flex flex-col-reverse items-stretch gap-3 pt-4 border-t border-border-subtle sm:flex-row sm:items-center sm:justify-end">
            <Button
               type="button"
               variant="outline"
               onClick={() => {
                  if (isSubmitting || isUploading) return;
                  for (const url of Array.from(
                     new Set([eventBannerUrl, punishmentPfpUrl])
                  )) {
                     if (url)
                        void discardChallengeImageUploadAction(url).catch(
                           () => {}
                        );
                  }
                  router.back();
               }}
               disabled={isSubmitting || isUploading}
               className="h-11 px-6 rounded-xl border-white text-white bg-transparent hover:bg-white/10 text-xs font-semibold"
            >
               Cancel
            </Button>
            <Button
               type="submit"
               disabled={isSubmitting || isUploading || !title.trim()}
               className="h-11 px-8 rounded-xl bg-white text-text-inverse hover:bg-white/90 text-xs font-bold shadow-lg"
            >
               {isSubmitting ? "Creating..." : "Create & Launch Challenge"}
            </Button>
         </div>
      </form>
   );
}
