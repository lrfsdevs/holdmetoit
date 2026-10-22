import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { extractManagedObjectPath } from "@/features/challenges/domain/punishment-pfp";

import {
   adminEnrollParticipantAction,
   adminUpdateParticipantTargetAction,
   createChallengeAction,
   deleteChallengeAction,
   kickoffChallengeAction,
   lockChallengeResultsAction,
   reassignParticipantTeamAction,
   removeChallengeParticipantAction,
   unlockChallengeResultsAction,
   updateChallengeAction,
} from "@/features/challenges/api/challenge-admin.actions";
import * as requireAdminModule from "@/features/auth/api/require-admin";
import * as challengeAdminRepo from "@/features/challenges/data/challenge-admin.repository";
import * as storage from "@/core/storage/supabase-storage";
import * as pfpRepo from "@/features/challenges/data/punishment-pfp.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

const PUBLIC_BASE =
   "https://abc.supabase.co/storage/v1/object/public/holdmetoit";
const OLD_BANNER = `${PUBLIC_BASE}/event-banners/old.png`;
const NEW_BANNER = `${PUBLIC_BASE}/event-banners/new.png`;
const OLD_PFP = `${PUBLIC_BASE}/punishment-pfps/old.png`;
const NEW_PFP = `${PUBLIC_BASE}/punishment-pfps/new.png`;
const ADMIN = { id: "admin_1", username: "HostAdmin" };
const UPDATE_INPUT = {
   challengeId: "c_1",
   title: "Updated Title",
   startAt: "2026-09-01T00:00:00Z",
   endAt: "2026-09-08T00:00:00Z",
   eventBannerUrl: NEW_BANNER,
   punishmentPfpUrl: NEW_PFP,
   teams: [{ name: "Bees", color: "#FFB066", iconEmoji: "🐝" }],
};

vi.mock("@/core/storage/supabase-storage", () => ({
   getStorageUrlConfig: vi.fn(),
   isManagedChallengeImageUrl: vi.fn(),
   deleteManagedChallengeImage: vi.fn(),
}));

vi.mock("@/features/challenges/data/punishment-pfp.repository", () => ({
   findChallengeImageUrls: vi.fn(),
   isChallengeImageReferenced: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
   revalidateTag: vi.fn(),
}));

vi.mock("@/features/auth/api/require-admin", () => ({
   AdminAccessError: class AdminAccessError extends Error {
      readonly code = "FORBIDDEN_NOT_ADMIN";
   },
   requireAdminUser: vi.fn(),
}));

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/features/challenges/data/challenge-admin.repository", () => ({
   createAdminChallenge: vi.fn(),
   kickoffChallenge: vi.fn(),
   lockChallengeResults: vi.fn(),
   unlockChallengeResults: vi.fn(),
   adminEnrollParticipant: vi.fn(),
   updateAdminChallenge: vi.fn(),
   reassignParticipantTeam: vi.fn(),
   deleteAdminChallenge: vi.fn(),
   removeChallengeParticipant: vi.fn(),
   adminUpdateParticipantTarget: vi.fn(),
}));

describe("challenge-admin actions (FEAT-CHAL-02, FEAT-CHAL-05)", () => {
   beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue(
         ADMIN as never
      );
      vi.mocked(storage.getStorageUrlConfig).mockImplementation((purpose) => ({
         supabaseUrl: "https://abc.supabase.co",
         bucket: "holdmetoit",
         folder:
            purpose === "event-banner" ? "event-banners" : "punishment-pfps",
      }));
      vi.mocked(storage.isManagedChallengeImageUrl).mockImplementation((url) =>
         ["event-banner", "punishment-pfp"].some(
            (purpose) =>
               extractManagedObjectPath(
                  url,
                  storage.getStorageUrlConfig(
                     purpose as "event-banner" | "punishment-pfp"
                  )
               ) !== null
         )
      );
      vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
         eventBannerUrl: OLD_BANNER,
         punishmentPfpUrl: OLD_PFP,
      });
      vi.mocked(pfpRepo.isChallengeImageReferenced).mockResolvedValue(false);
      vi.mocked(challengeAdminRepo.createAdminChallenge).mockResolvedValue({
         id: "c_1",
      } as never);
      vi.mocked(challengeAdminRepo.updateAdminChallenge).mockResolvedValue({
         id: "c_1",
      } as never);
      vi.mocked(challengeAdminRepo.deleteAdminChallenge).mockResolvedValue({
         id: "c_1",
      } as never);
   });

   afterEach(() => {
      vi.restoreAllMocks();
   });

   describe("adminEnrollParticipantAction", () => {
      it("successfully enrolls user into team when called by admin", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
         } as never);

         vi.mocked(challengeAdminRepo.adminEnrollParticipant).mockResolvedValue(
            {
               id: "part_new",
            } as never
         );

         const result = await adminEnrollParticipantAction({
            challengeId: "c_1",
            userId: "u_2",
            teamId: "t_1",
            targetSeconds: 126000,
            reason: "Host Discord assignment",
         });

         expect(result).toEqual({ ok: true });
         expect(challengeAdminRepo.adminEnrollParticipant).toHaveBeenCalledWith(
            {
               challengeId: "c_1",
               userId: "u_2",
               teamId: "t_1",
               targetSeconds: 126000,
               reason: "Host Discord assignment",
               admin: { id: "admin_1", username: "HostAdmin" },
            }
         );
      });

      it("rejects when reason is too short", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
         } as never);

         const result = await adminEnrollParticipantAction({
            challengeId: "c_1",
            userId: "u_2",
            teamId: "t_1",
            targetSeconds: 126000,
            reason: "ab",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_INPUT");
         }
         expect(
            challengeAdminRepo.adminEnrollParticipant
         ).not.toHaveBeenCalled();
      });

      it("rejects non-admin caller with FORBIDDEN_NOT_ADMIN", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
            new requireAdminModule.AdminAccessError()
         );

         const result = await adminEnrollParticipantAction({
            challengeId: "c_1",
            userId: "u_2",
            teamId: "t_1",
            targetSeconds: 126000,
            reason: "Manual assignment",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FORBIDDEN_NOT_ADMIN");
         }
      });
   });

   describe("removeChallengeParticipantAction", () => {
      it("removes a participant when called by an admin", async () => {
         vi.mocked(
            challengeAdminRepo.removeChallengeParticipant
         ).mockResolvedValue({
            participantId: "p_1",
            removedName: "Afnan",
         } as never);

         const result = await removeChallengeParticipantAction({
            challengeId: "c_1",
            participantId: "p_1",
            reason: "Duplicate enrollment",
         });

         expect(result).toEqual({ ok: true });
         expect(
            challengeAdminRepo.removeChallengeParticipant
         ).toHaveBeenCalledWith({
            participantId: "p_1",
            reason: "Duplicate enrollment",
            admin: { id: "admin_1", username: "HostAdmin" },
         });
         expect(revalidatePath).toHaveBeenCalledWith("/challenge/c_1");
      });

      it("rejects when reason is too short", async () => {
         const result = await removeChallengeParticipantAction({
            challengeId: "c_1",
            participantId: "p_1",
            reason: "ab",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("INVALID_INPUT");
         }
         expect(
            challengeAdminRepo.removeChallengeParticipant
         ).not.toHaveBeenCalled();
      });

      it("rejects non-admin caller with FORBIDDEN_NOT_ADMIN", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
            new requireAdminModule.AdminAccessError()
         );

         const result = await removeChallengeParticipantAction({
            challengeId: "c_1",
            participantId: "p_1",
            reason: "Host cleanup",
         });

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("FORBIDDEN_NOT_ADMIN");
         }
      });
   });

   describe("kickoffChallengeAction", () => {
      it("transitions challenge status to ACTIVE", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
         } as never);

         vi.mocked(challengeAdminRepo.kickoffChallenge).mockResolvedValue({
            id: "c_1",
            status: "ACTIVE",
         } as never);

         const result = await kickoffChallengeAction("c_1");
         expect(result).toEqual({ ok: true });
         expect(challengeAdminRepo.kickoffChallenge).toHaveBeenCalledWith(
            "c_1",
            {
               id: "admin_1",
               username: "HostAdmin",
            }
         );
      });
   });

   describe("lockChallengeResultsAction", () => {
      it("locks final challenge results", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
         } as never);

         vi.mocked(challengeAdminRepo.lockChallengeResults).mockResolvedValue({
            id: "c_1",
            status: "COMPLETED",
         } as never);

         const result = await lockChallengeResultsAction("c_1");
         expect(result).toEqual({ ok: true });
         expect(challengeAdminRepo.lockChallengeResults).toHaveBeenCalledWith(
            "c_1",
            {
               id: "admin_1",
               username: "HostAdmin",
            },
            { settleTrophies: true, settleRewards: true }
         );
      });

      it("skips trophy and reward settlement when the leaderboard flag is off", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
         } as never);
         vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false);
         vi.mocked(challengeAdminRepo.lockChallengeResults).mockResolvedValue({
            id: "c_1",
            status: "COMPLETED",
         } as never);

         await lockChallengeResultsAction("c_1");

         expect(challengeAdminRepo.lockChallengeResults).toHaveBeenCalledWith(
            "c_1",
            { id: "admin_1", username: "HostAdmin" },
            { settleTrophies: false, settleRewards: false }
         );
      });
   });

   describe("unlockChallengeResultsAction", () => {
      it("unlocks and reverts the final results", async () => {
         vi.mocked(challengeAdminRepo.unlockChallengeResults).mockResolvedValue(
            {
               id: "c_1",
               status: "ACTIVE",
            } as never
         );

         const result = await unlockChallengeResultsAction("c_1");

         expect(result).toEqual({ ok: true });
         expect(challengeAdminRepo.unlockChallengeResults).toHaveBeenCalledWith(
            "c_1",
            {
               id: "admin_1",
               username: "HostAdmin",
            }
         );
         expect(revalidatePath).toHaveBeenCalledWith("/challenge/c_1");
      });

      it("maps repository failures to UNLOCK_FAILED", async () => {
         vi.mocked(challengeAdminRepo.unlockChallengeResults).mockRejectedValue(
            new Error("Challenge results are not locked.")
         );

         const result = await unlockChallengeResultsAction("c_1");

         expect(result.ok).toBe(false);
         if (!result.ok) {
            expect(result.code).toBe("UNLOCK_FAILED");
            expect(result.message).toBe("Challenge results are not locked.");
         }
      });
   });

   describe("createChallengeAction dual images", () => {
      const input = {
         title: "Bees vs Butterflies",
         format: "TEAM_VS_TEAM" as const,
         startAt: UPDATE_INPUT.startAt,
         endAt: UPDATE_INPUT.endAt,
         eventBannerUrl: NEW_BANNER,
         punishmentPfpUrl: NEW_PFP,
         teams: [{ name: "Bees" }, { name: "Butterflies" }],
      };

      it("saves the two distinct image URLs independently", async () => {
         await expect(createChallengeAction(input)).resolves.toEqual({
            ok: true,
            data: { challengeId: "c_1" },
         });
         expect(challengeAdminRepo.createAdminChallenge).toHaveBeenCalledWith(
            input,
            ADMIN
         );
         expect(storage.getStorageUrlConfig).toHaveBeenCalledWith(
            "event-banner"
         );
         expect(storage.getStorageUrlConfig).toHaveBeenCalledWith(
            "punishment-pfp"
         );
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });

      it("creates challenge with optional description", async () => {
         const inputWithDesc = {
            ...input,
            description: "Custom challenge description",
         };
         await expect(createChallengeAction(inputWithDesc)).resolves.toEqual({
            ok: true,
            data: { challengeId: "c_1" },
         });
         expect(challengeAdminRepo.createAdminChallenge).toHaveBeenCalledWith(
            inputWithDesc,
            ADMIN
         );
      });

      it.each(["eventBannerUrl", "punishmentPfpUrl"] as const)(
         "requires %s even when the other image exists",
         async (field) => {
            const missing = { ...input };
            Reflect.deleteProperty(missing, field);
            for (const invalid of [
               missing,
               { ...input, [field]: "" },
               { ...input, [field]: " \t\n " },
               { ...input, [field]: null },
            ]) {
               await expect(
                  createChallengeAction(
                     invalid as Parameters<typeof createChallengeAction>[0]
                  )
               ).resolves.toMatchObject({
                  ok: false,
                  code: "INVALID_INPUT",
               });
            }
            expect(
               challengeAdminRepo.createAdminChallenge
            ).not.toHaveBeenCalled();
         }
      );

      it.each([
         { eventBannerUrl: NEW_PFP, code: "INVALID_EVENT_BANNER" },
         { punishmentPfpUrl: NEW_BANNER, code: "INVALID_PUNISHMENT_PFP" },
         {
            eventBannerUrl: NEW_PFP,
            punishmentPfpUrl: NEW_BANNER,
            code: "INVALID_EVENT_BANNER",
         },
         {
            eventBannerUrl: "/prototype/assets/hero.jpg",
            code: "INVALID_EVENT_BANNER",
         },
         {
            punishmentPfpUrl: "/prototype/assets/pfp.jpg",
            code: "INVALID_PUNISHMENT_PFP",
         },
         {
            eventBannerUrl: "https://example.com/banner.png",
            code: "INVALID_EVENT_BANNER",
         },
         {
            punishmentPfpUrl: "https://example.com/pfp.png",
            code: "INVALID_PUNISHMENT_PFP",
         },
      ])(
         "rejects wrong-folder, legacy and external images (%j)",
         async ({ code, ...images }) => {
            await expect(
               createChallengeAction({ ...input, ...images })
            ).resolves.toMatchObject({
               ok: false,
               code,
            });
            expect(
               challengeAdminRepo.createAdminChallenge
            ).not.toHaveBeenCalled();
         }
      );

      it("trims both creation image URLs before validating and saving them", async () => {
         await expect(
            createChallengeAction({
               ...input,
               eventBannerUrl: ` \t${NEW_BANNER}\n `,
               punishmentPfpUrl: ` \t${NEW_PFP}\n `,
            })
         ).resolves.toEqual({ ok: true, data: { challengeId: "c_1" } });
         expect(
            challengeAdminRepo.createAdminChallenge
         ).toHaveBeenCalledExactlyOnceWith(input, ADMIN);
      });

      it("fails closed when storage URL configuration is unavailable", async () => {
         vi.mocked(storage.getStorageUrlConfig).mockImplementation(() => {
            throw new Error("Missing config");
         });
         await expect(createChallengeAction(input)).resolves.toMatchObject({
            ok: false,
            code: "INVALID_EVENT_BANNER",
         });
         expect(challengeAdminRepo.createAdminChallenge).not.toHaveBeenCalled();
      });
   });

   describe("updateChallengeAction", () => {
      it("saves both URLs and cleans both old images only after the update commits", async () => {
         let committed = false;
         vi.mocked(challengeAdminRepo.updateAdminChallenge).mockImplementation(
            async () => {
               expect(
                  pfpRepo.isChallengeImageReferenced
               ).not.toHaveBeenCalled();
               expect(
                  storage.deleteManagedChallengeImage
               ).not.toHaveBeenCalled();
               committed = true;
               return { id: "c_1" } as never;
            }
         );
         vi.mocked(pfpRepo.isChallengeImageReferenced).mockImplementation(
            async () => {
               expect(committed).toBe(true);
               return false;
            }
         );
         await expect(updateChallengeAction(UPDATE_INPUT)).resolves.toEqual({
            ok: true,
         });
         const { challengeId, ...data } = UPDATE_INPUT;
         expect(challengeAdminRepo.updateAdminChallenge).toHaveBeenCalledWith(
            challengeId,
            data,
            ADMIN
         );
         expect(pfpRepo.findChallengeImageUrls).toHaveBeenCalledWith(
            challengeId
         );
         expect(
            vi.mocked(storage.deleteManagedChallengeImage).mock.calls
         ).toEqual([[OLD_BANNER], [OLD_PFP]]);
      });

      it("updates challenge description and passes to repository", async () => {
         const inputWithDesc = {
            ...UPDATE_INPUT,
            description: "Updated challenge rules and description",
         };
         await expect(updateChallengeAction(inputWithDesc)).resolves.toEqual({
            ok: true,
         });
         const { challengeId, ...data } = inputWithDesc;
         expect(challengeAdminRepo.updateAdminChallenge).toHaveBeenCalledWith(
            challengeId,
            data,
            ADMIN
         );
      });

      it.each([
         {
            eventBannerUrl: NEW_BANNER,
            punishmentPfpUrl: OLD_PFP,
            removed: OLD_BANNER,
         },
         {
            eventBannerUrl: OLD_BANNER,
            punishmentPfpUrl: NEW_PFP,
            removed: OLD_PFP,
         },
      ])(
         "replaces one image without changing or cleaning the other (%j)",
         async ({ removed, ...images }) => {
            await expect(
               updateChallengeAction({ ...UPDATE_INPUT, ...images })
            ).resolves.toEqual({ ok: true });
            expect(
               challengeAdminRepo.updateAdminChallenge
            ).toHaveBeenCalledWith(
               "c_1",
               expect.objectContaining(images),
               ADMIN
            );
            expect(
               pfpRepo.isChallengeImageReferenced
            ).toHaveBeenCalledExactlyOnceWith(removed);
            expect(
               storage.deleteManagedChallengeImage
            ).toHaveBeenCalledExactlyOnceWith(removed);
         }
      );

      it("does not check references or delete unchanged images", async () => {
         await expect(
            updateChallengeAction({
               ...UPDATE_INPUT,
               eventBannerUrl: OLD_BANNER,
               punishmentPfpUrl: OLD_PFP,
            })
         ).resolves.toEqual({ ok: true });
         expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });

      it.each([
         { eventBannerUrl: null, punishmentPfpUrl: null },
         {
            eventBannerUrl: null,
            punishmentPfpUrl: "/prototype/assets/pfp.jpg",
         },
         {
            eventBannerUrl: "/prototype/assets/hero.jpg",
            punishmentPfpUrl: null,
         },
         {
            eventBannerUrl: "https://example.com/old.png",
            punishmentPfpUrl: "/prototype/assets/pfp.jpg",
         },
         { eventBannerUrl: OLD_BANNER, punishmentPfpUrl: OLD_BANNER },
         { eventBannerUrl: "", punishmentPfpUrl: "" },
         { eventBannerUrl: " \t\n ", punishmentPfpUrl: "\n\t " },
         { eventBannerUrl: "", punishmentPfpUrl: " \t " },
         { eventBannerUrl: " \n ", punishmentPfpUrl: "" },
         {
            eventBannerUrl: " /prototype/assets/hero.jpg ",
            punishmentPfpUrl: "\t/prototype/assets/pfp.jpg\n",
         },
         {
            eventBannerUrl: ` ${OLD_BANNER} `,
            punishmentPfpUrl: `\t${OLD_PFP}\n`,
         },
      ])(
         "preserves exact stored raw legacy/null/wrong-folder values (%j)",
         async (images) => {
            vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue(images);
            const { challengeId, ...data } = { ...UPDATE_INPUT, ...images };
            await expect(
               updateChallengeAction({ challengeId, ...data })
            ).resolves.toEqual({ ok: true });
            expect(
               challengeAdminRepo.updateAdminChallenge
            ).toHaveBeenCalledExactlyOnceWith(challengeId, data, ADMIN);
            expect(storage.getStorageUrlConfig).not.toHaveBeenCalled();
            expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
            expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
         }
      );

      it.each(["eventBannerUrl", "punishmentPfpUrl"] as const)(
         "allows a valid replacement for a stored null %s",
         async (field) => {
            vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
               eventBannerUrl: null,
               punishmentPfpUrl: null,
            });
            const images = {
               eventBannerUrl: null,
               punishmentPfpUrl: null,
               [field]: UPDATE_INPUT[field],
            };
            await expect(
               updateChallengeAction({ ...UPDATE_INPUT, ...images })
            ).resolves.toEqual({ ok: true });
            expect(
               challengeAdminRepo.updateAdminChallenge
            ).toHaveBeenCalledWith(
               "c_1",
               expect.objectContaining(images),
               ADMIN
            );
            expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
         }
      );

      it.each([
         { eventBannerUrl: NEW_PFP, code: "INVALID_EVENT_BANNER" },
         { punishmentPfpUrl: NEW_BANNER, code: "INVALID_PUNISHMENT_PFP" },
         {
            eventBannerUrl: OLD_PFP,
            punishmentPfpUrl: OLD_BANNER,
            code: "INVALID_EVENT_BANNER",
         },
         { eventBannerUrl: null, code: "INVALID_EVENT_BANNER" },
         { punishmentPfpUrl: null, code: "INVALID_PUNISHMENT_PFP" },
         {
            eventBannerUrl: "https://example.com/banner.png",
            code: "INVALID_EVENT_BANNER",
         },
         {
            punishmentPfpUrl: "https://example.com/pfp.png",
            code: "INVALID_PUNISHMENT_PFP",
         },
         {
            eventBannerUrl: "/prototype/assets/new.jpg",
            code: "INVALID_EVENT_BANNER",
         },
         {
            punishmentPfpUrl: "/prototype/assets/new.jpg",
            code: "INVALID_PUNISHMENT_PFP",
         },
      ])(
         "rejects changed images outside their folder or clearing a saved image (%j)",
         async ({ code, ...images }) => {
            await expect(
               updateChallengeAction({ ...UPDATE_INPUT, ...images })
            ).resolves.toMatchObject({ ok: false, code });
            expect(
               challengeAdminRepo.updateAdminChallenge
            ).not.toHaveBeenCalled();
            expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
            expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
         }
      );

      it.each(["eventBannerUrl", "punishmentPfpUrl"] as const)(
         "does not grandfather a different legacy %s",
         async (field) => {
            vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
               eventBannerUrl: "/prototype/assets/old-banner.jpg",
               punishmentPfpUrl: "/prototype/assets/old-pfp.jpg",
            });
            await expect(
               updateChallengeAction({
                  ...UPDATE_INPUT,
                  eventBannerUrl: "/prototype/assets/old-banner.jpg",
                  punishmentPfpUrl: "/prototype/assets/old-pfp.jpg",
                  [field]: "/prototype/assets/different.jpg",
               })
            ).resolves.toMatchObject({
               ok: false,
               code:
                  field === "eventBannerUrl"
                     ? "INVALID_EVENT_BANNER"
                     : "INVALID_PUNISHMENT_PFP",
            });
            expect(
               challengeAdminRepo.updateAdminChallenge
            ).not.toHaveBeenCalled();
         }
      );

      describe.each(["eventBannerUrl", "punishmentPfpUrl"] as const)(
         "raw %s validation",
         (field) => {
            it.each([
               "",
               " \t\n ",
               ` ${UPDATE_INPUT[field]}`,
               `${UPDATE_INPUT[field]} `,
               ` \t${UPDATE_INPUT[field]}\n `,
            ])(
               "rejects changed empty/whitespace/padded URLs without trimming (%j)",
               async (rawUrl) => {
                  await expect(
                     updateChallengeAction({ ...UPDATE_INPUT, [field]: rawUrl })
                  ).resolves.toMatchObject({
                     ok: false,
                     code:
                        field === "eventBannerUrl"
                           ? "INVALID_EVENT_BANNER"
                           : "INVALID_PUNISHMENT_PFP",
                  });
                  expect(pfpRepo.findChallengeImageUrls).toHaveBeenCalledWith(
                     "c_1"
                  );
                  expect(
                     challengeAdminRepo.updateAdminChallenge
                  ).not.toHaveBeenCalled();
                  expect(
                     pfpRepo.isChallengeImageReferenced
                  ).not.toHaveBeenCalled();
                  expect(
                     storage.deleteManagedChallengeImage
                  ).not.toHaveBeenCalled();
               }
            );

            it("does not grandfather a different raw whitespace string", async () => {
               const images = {
                  eventBannerUrl: " \t ",
                  punishmentPfpUrl: " \t ",
               };
               vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue(
                  images
               );
               await expect(
                  updateChallengeAction({
                     ...UPDATE_INPUT,
                     ...images,
                     [field]: " ",
                  })
               ).resolves.toMatchObject({
                  ok: false,
                  code:
                     field === "eventBannerUrl"
                        ? "INVALID_EVENT_BANNER"
                        : "INVALID_PUNISHMENT_PFP",
               });
               expect(
                  challengeAdminRepo.updateAdminChallenge
               ).not.toHaveBeenCalled();
               expect(
                  pfpRepo.isChallengeImageReferenced
               ).not.toHaveBeenCalled();
               expect(
                  storage.deleteManagedChallengeImage
               ).not.toHaveBeenCalled();
            });
         }
      );

      it("keeps both images when the update fails", async () => {
         vi.mocked(challengeAdminRepo.updateAdminChallenge).mockRejectedValue(
            new Error("db down")
         );
         await expect(
            updateChallengeAction(UPDATE_INPUT)
         ).resolves.toMatchObject({ ok: false, code: "UPDATE_FAILED" });
         expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
         expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("retains a replaced image referenced in either column elsewhere", async () => {
         vi.mocked(pfpRepo.isChallengeImageReferenced).mockImplementation(
            async (url) => url === OLD_BANNER
         );
         await expect(updateChallengeAction(UPDATE_INPUT)).resolves.toEqual({
            ok: true,
         });
         expect(
            vi.mocked(pfpRepo.isChallengeImageReferenced).mock.calls
         ).toEqual([[OLD_BANNER], [OLD_PFP]]);
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(OLD_PFP);
      });

      it("retains a migrated shared banner that remains saved as the punishment PFP", async () => {
         vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
            eventBannerUrl: OLD_BANNER,
            punishmentPfpUrl: OLD_BANNER,
         });
         vi.mocked(pfpRepo.isChallengeImageReferenced).mockResolvedValue(true);
         await expect(
            updateChallengeAction({
               ...UPDATE_INPUT,
               punishmentPfpUrl: OLD_BANNER,
            })
         ).resolves.toEqual({ ok: true });
         expect(
            pfpRepo.isChallengeImageReferenced
         ).toHaveBeenCalledExactlyOnceWith(OLD_BANNER);
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });

      it("deduplicates a legacy shared image when replacing both fields", async () => {
         vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
            eventBannerUrl: OLD_BANNER,
            punishmentPfpUrl: OLD_BANNER,
         });
         await expect(updateChallengeAction(UPDATE_INPUT)).resolves.toEqual({
            ok: true,
         });
         expect(
            pfpRepo.isChallengeImageReferenced
         ).toHaveBeenCalledExactlyOnceWith(OLD_BANNER);
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(OLD_BANNER);
      });

      it("retains an image on reference-query failure but finishes the save and other cleanup", async () => {
         const error = new Error("reference query failed");
         const log = vi.spyOn(console, "error").mockImplementation(() => {});
         vi.mocked(pfpRepo.isChallengeImageReferenced)
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce(false);
         await expect(updateChallengeAction(UPDATE_INPUT)).resolves.toEqual({
            ok: true,
         });
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(OLD_PFP);
         expect(log).toHaveBeenCalledTimes(1);
         expect(String(log.mock.calls[0]?.[0])).toContain(
            "storage.cleanup_skipped"
         );
         expect(String(log.mock.calls[0]?.[0])).toContain(error.message);
         expect(revalidatePath).toHaveBeenCalledWith("/challenge/c_1");
      });

      it("rejects a missing challenge without saving or cleanup", async () => {
         vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue(null);
         await expect(
            updateChallengeAction(UPDATE_INPUT)
         ).resolves.toMatchObject({ ok: false, code: "NOT_FOUND" });
         expect(challengeAdminRepo.updateAdminChallenge).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });

      it("rejects when endAt is before startAt", async () => {
         await expect(
            updateChallengeAction({
               ...UPDATE_INPUT,
               startAt: UPDATE_INPUT.endAt,
               endAt: UPDATE_INPUT.startAt,
            })
         ).resolves.toMatchObject({ ok: false, code: "INVALID_DATES" });
         expect(challengeAdminRepo.updateAdminChallenge).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });
   });

   describe("reassignParticipantTeamAction", () => {
      it("reassigns participant when called by admin", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue({
            id: "admin_1",
            username: "HostAdmin",
         } as never);

         vi.mocked(
            challengeAdminRepo.reassignParticipantTeam
         ).mockResolvedValue({
            id: "part_1",
         } as never);

         const result = await reassignParticipantTeamAction({
            challengeId: "c_1",
            participantId: "part_1",
            newTeamId: "t_2",
         });

         expect(result).toEqual({ ok: true });
         expect(
            challengeAdminRepo.reassignParticipantTeam
         ).toHaveBeenCalledWith({
            participantId: "part_1",
            newTeamId: "t_2",
            reason: undefined,
            admin: { id: "admin_1", username: "HostAdmin" },
         });
      });
   });

   describe("deleteChallengeAction", () => {
      it("deletes both images only after deleting the challenge and returns redirectTo", async () => {
         let committed = false;
         vi.mocked(challengeAdminRepo.deleteAdminChallenge).mockImplementation(
            async () => {
               expect(
                  pfpRepo.isChallengeImageReferenced
               ).not.toHaveBeenCalled();
               expect(
                  storage.deleteManagedChallengeImage
               ).not.toHaveBeenCalled();
               committed = true;
               return { id: "c_1" } as never;
            }
         );
         vi.mocked(pfpRepo.isChallengeImageReferenced).mockImplementation(
            async () => {
               expect(committed).toBe(true);
               return false;
            }
         );
         await expect(deleteChallengeAction("c_1")).resolves.toEqual({
            ok: true,
            data: { redirectTo: "/challenges" },
         });
         expect(challengeAdminRepo.deleteAdminChallenge).toHaveBeenCalledWith(
            "c_1",
            ADMIN
         );
         expect(
            vi.mocked(storage.deleteManagedChallengeImage).mock.calls
         ).toEqual([[OLD_BANNER], [OLD_PFP]]);
      });

      it("keeps both images when deletion fails", async () => {
         vi.mocked(challengeAdminRepo.deleteAdminChallenge).mockRejectedValue(
            new Error("db down")
         );
         await expect(deleteChallengeAction("c_1")).resolves.toMatchObject({
            ok: false,
            code: "DELETE_FAILED",
         });
         expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
         expect(revalidatePath).not.toHaveBeenCalled();
      });

      it("deletes a duplicate image in both columns only once", async () => {
         vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
            eventBannerUrl: OLD_BANNER,
            punishmentPfpUrl: OLD_BANNER,
         });
         await expect(deleteChallengeAction("c_1")).resolves.toMatchObject({
            ok: true,
         });
         expect(
            pfpRepo.isChallengeImageReferenced
         ).toHaveBeenCalledExactlyOnceWith(OLD_BANNER);
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(OLD_BANNER);
      });

      it("retains images still referenced by another challenge in either column", async () => {
         vi.mocked(pfpRepo.isChallengeImageReferenced).mockResolvedValue(true);
         await expect(deleteChallengeAction("c_1")).resolves.toMatchObject({
            ok: true,
         });
         expect(
            vi.mocked(pfpRepo.isChallengeImageReferenced).mock.calls
         ).toEqual([[OLD_BANNER], [OLD_PFP]]);
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });

      it("retains the image on a failed reference query and continues best-effort cleanup", async () => {
         const error = new Error("reference query failed");
         const log = vi.spyOn(console, "error").mockImplementation(() => {});
         vi.mocked(pfpRepo.isChallengeImageReferenced)
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce(false);
         await expect(deleteChallengeAction("c_1")).resolves.toEqual({
            ok: true,
            data: { redirectTo: "/challenges" },
         });
         expect(
            storage.deleteManagedChallengeImage
         ).toHaveBeenCalledExactlyOnceWith(OLD_PFP);
         expect(log).toHaveBeenCalledTimes(1);
         expect(String(log.mock.calls[0]?.[0])).toContain(
            "storage.cleanup_skipped"
         );
         expect(String(log.mock.calls[0]?.[0])).toContain(error.message);
         expect(revalidatePath).toHaveBeenCalledWith("/challenges");
      });

      it("skips legacy and null images", async () => {
         vi.mocked(pfpRepo.findChallengeImageUrls).mockResolvedValue({
            eventBannerUrl: null,
            punishmentPfpUrl: "/prototype/assets/pfp.jpg",
         });
         await expect(deleteChallengeAction("c_1")).resolves.toMatchObject({
            ok: true,
         });
         expect(pfpRepo.isChallengeImageReferenced).not.toHaveBeenCalled();
         expect(storage.deleteManagedChallengeImage).not.toHaveBeenCalled();
      });
   });

   describe("adminUpdateParticipantTargetAction (Law L5 / FEAT-DECL-04)", () => {
      it("successfully updates target hours with hours/minutes/seconds", async () => {
         vi.mocked(
            challengeAdminRepo.adminUpdateParticipantTarget
         ).mockResolvedValue({
            id: "p_1",
            targetSeconds: 126000,
         } as never);

         const result = await adminUpdateParticipantTargetAction({
            challengeId: "c_1",
            participantId: "p_1",
            hours: 35,
            minutes: 0,
            seconds: 0,
            reason: "Adjusted by host",
         });

         expect(result).toEqual({
            ok: true,
            data: { targetSeconds: 126000 },
         });
         expect(
            challengeAdminRepo.adminUpdateParticipantTarget
         ).toHaveBeenCalledWith({
            challengeId: "c_1",
            participantId: "p_1",
            targetSeconds: 126000,
            reason: "Adjusted by host",
            admin: ADMIN,
         });
         expect(revalidatePath).toHaveBeenCalledWith("/challenge/c_1");
         expect(revalidatePath).toHaveBeenCalledWith(
            "/challenge/c_1/participant/p_1"
         );
      });

      it("successfully updates target hours when targetSeconds is passed directly", async () => {
         vi.mocked(
            challengeAdminRepo.adminUpdateParticipantTarget
         ).mockResolvedValue({
            id: "p_1",
            targetSeconds: 72000,
         } as never);

         const result = await adminUpdateParticipantTargetAction({
            challengeId: "c_1",
            participantId: "p_1",
            targetSeconds: 72000,
         });

         expect(result).toEqual({
            ok: true,
            data: { targetSeconds: 72000 },
         });
         expect(
            challengeAdminRepo.adminUpdateParticipantTarget
         ).toHaveBeenCalledWith({
            challengeId: "c_1",
            participantId: "p_1",
            targetSeconds: 72000,
            reason: undefined,
            admin: ADMIN,
         });
      });

      it("rejects non-admin user with AdminAccessError", async () => {
         vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValueOnce(
            new requireAdminModule.AdminAccessError()
         );

         const result = await adminUpdateParticipantTargetAction({
            challengeId: "c_1",
            participantId: "p_1",
            hours: 20,
         });

         expect(result).toMatchObject({
            ok: false,
            code: "FORBIDDEN_NOT_ADMIN",
         });
      });

      it("rejects targets less than 1 hour (< 3600 seconds)", async () => {
         const result = await adminUpdateParticipantTargetAction({
            challengeId: "c_1",
            participantId: "p_1",
            hours: 0,
            minutes: 30,
            seconds: 0,
         });

         expect(result).toEqual({
            ok: false,
            code: "TARGET_TOO_LOW",
            message: "Weekly target must be at least 1 hour.",
         });
      });

      it("rejects targets greater than 105 hours", async () => {
         const result = await adminUpdateParticipantTargetAction({
            challengeId: "c_1",
            participantId: "p_1",
            targetSeconds: 400000,
         });

         expect(result).toEqual({
            ok: false,
            code: "TARGET_TOO_HIGH",
            message: "Weekly target cannot exceed 105 hours.",
         });
      });

      it("handles repository failure gracefully", async () => {
         vi.mocked(
            challengeAdminRepo.adminUpdateParticipantTarget
         ).mockRejectedValueOnce(new Error("Participant not found."));

         const result = await adminUpdateParticipantTargetAction({
            challengeId: "c_1",
            participantId: "p_1",
            hours: 20,
         });

         expect(result).toEqual({
            ok: false,
            code: "UPDATE_TARGET_FAILED",
            message: "Participant not found.",
         });
      });
   });
});
