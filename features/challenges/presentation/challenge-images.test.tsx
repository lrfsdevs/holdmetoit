import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   createElement,
   isValidElement,
   type ReactElement,
   type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ChallengeScoreboardViewModel } from "@/features/leaderboard/domain/leaderboard.types";
import { ChallengeImageInput } from "./challenge-image-input";
import { ChallengeCreatorWizard } from "./challenge-creator-wizard";
import { ChallengeManageTab } from "./challenge-manage-tab";
import { Button } from "@/components/ui/button";

const mocks = vi.hoisted(() => ({
   upload: vi.fn(),
   discard: vi.fn(),
   create: vi.fn(),
   update: vi.fn(),
   back: vi.fn(),
   push: vi.fn(),
   refresh: vi.fn(),
   live: false,
   cursor: 0,
   slots: [] as unknown[],
}));

// Keep SSR on real React; use a tiny hook harness only to exercise UI callbacks in Node.
vi.mock("react", async (importOriginal) => {
   const actual = await importOriginal<typeof import("react")>();
   return {
      ...actual,
      useState: (initial: unknown) => {
         if (!mocks.live) return actual.useState(initial);
         const index = mocks.cursor++;
         if (!(index in mocks.slots)) {
            mocks.slots[index] =
               typeof initial === "function" ? initial() : initial;
         }
         return [
            mocks.slots[index],
            (next: unknown) => {
               mocks.slots[index] =
                  typeof next === "function" ? next(mocks.slots[index]) : next;
            },
         ];
      },
      useRef: (initial: unknown) => {
         if (!mocks.live) return actual.useRef(initial);
         const index = mocks.cursor++;
         if (!(index in mocks.slots)) mocks.slots[index] = { current: initial };
         return mocks.slots[index];
      },
      useId: () => (mocks.live ? "test-input" : actual.useId()),
      useEffect: (...args: Parameters<typeof actual.useEffect>) => {
         if (!mocks.live) return actual.useEffect(...args);
      },
      useTransition: () =>
         mocks.live
            ? [
                 false,
                 (callback: () => void) => {
                    void callback();
                 },
              ]
            : actual.useTransition(),
   };
});

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      className,
      sizes,
   }: {
      src: string;
      alt: string;
      className: string;
      sizes: string;
   }) => createElement("img", { src, alt, className, sizes }),
}));
vi.mock("next/navigation", () => ({
   useRouter: () => ({
      back: mocks.back,
      push: mocks.push,
      refresh: mocks.refresh,
   }),
}));
vi.mock("@/features/challenges/api/punishment-pfp.actions", () => ({
   uploadChallengeImageAction: mocks.upload,
   discardChallengeImageUploadAction: mocks.discard,
}));
vi.mock("@/features/challenges/api/challenge-admin.actions", () => ({
   createChallengeAction: mocks.create,
   updateChallengeAction: mocks.update,
   deleteChallengeAction: vi.fn(),
   kickoffChallengeAction: vi.fn(),
   lockChallengeResultsAction: vi.fn(),
   reassignParticipantTeamAction: vi.fn(),
}));

const banner = "https://example.test/event-banners/banner.webp";
const pfp = "https://example.test/punishment-pfps/avatar.png";
const challenge: ChallengeScoreboardViewModel = {
   id: "challenge-1",
   title: "Reading Week",
   heroImageUrl: "/display-banner.png",
   eventBannerUrl: banner,
   punishmentPfpUrl: pfp,
   format: "SOLOS",
   status: "UPCOMING",
   startAt: "2026-10-01T00:00:00.000Z",
   endAt: "2026-10-08T00:00:00.000Z",
   daysRemaining: 7,
   totalDays: 7,
   currentDayNumber: 1,
   timeRemainingHuman: "7d",
   teams: [],
   matchHeader: {
      hasMatchup: false,
      teamA: null,
      teamB: null,
      leadMarginSeconds: 0,
      leadMarginClock: "00:00:00",
      leadMarginHuman: "Tied",
      leaderTeamId: null,
      leaderSide: "tie",
      ratioPercentageA: 50,
      ratioPercentageB: 50,
   },
   standings: [],
   punishmentWall: {
      punishmentPfpUrl: "/fallback-avatar.png",
      flaggedMembers: [],
      isEventCompleted: false,
   },
   currentUser: {
      isLoggedIn: false,
      isEnrolled: false,
      participantId: null,
      isWrappedSeen: false,
      isFeedbackFilled: false,
   },
};

function elements(node: ReactNode): ReactElement[] {
   if (Array.isArray(node)) return node.flatMap(elements);
   if (!isValidElement<{ children?: ReactNode }>(node)) return [];
   return [node, ...elements(node.props.children)];
}

function find(tree: ReactNode, predicate: (element: ReactElement) => boolean) {
   const element = elements(tree).find(predicate);
   if (!element) throw new Error("Expected UI element was not rendered");
   return element;
}

function image(tree: ReactNode, purpose: "event-banner" | "punishment-pfp") {
   return find(
      tree,
      (element) =>
         element.type === ChallengeImageInput &&
         element.props.purpose === purpose
   );
}

function button(tree: ReactNode, text: string) {
   return find(
      tree,
      (element) =>
         element.type === Button &&
         elements(element.props.children).length === 0 &&
         element.props.children === text
   );
}

function liveRender(render: () => ReactElement) {
   mocks.live = true;
   mocks.cursor = 0;
   return render();
}

function deferred<T>() {
   let resolve!: (value: T) => void;
   const promise = new Promise<T>((done) => {
      resolve = done;
   });
   return { promise, resolve };
}

beforeEach(() => {
   vi.clearAllMocks();
   mocks.live = false;
   mocks.cursor = 0;
   mocks.slots = [];
   mocks.discard.mockResolvedValue({ ok: true });
   mocks.upload.mockResolvedValue({ ok: true, data: { url: pfp } });
   mocks.create.mockResolvedValue({
      ok: true,
      data: { challengeId: "new-challenge" },
   });
   mocks.update.mockResolvedValue({ ok: true });
});

describe("ChallengeImageInput SSR", () => {
   it.each([
      [
         "event-banner",
         "Event Header Image",
         banner,
         "aspect-[5/1]",
         "Displayed as the challenge banner and event thumbnail in the admin console.",
      ],
      [
         "punishment-pfp",
         "Assigned Punishment PFP",
         pfp,
         "rounded-full",
         "The avatar assigned to participants who fail the challenge’s accountability requirements.",
      ],
   ] as const)(
      "renders the %s label, helper and appropriate preview",
      (purpose, label, url, shape, helper) => {
         const html = renderToStaticMarkup(
            createElement(ChallengeImageInput, {
               purpose,
               value: url,
               onChange: vi.fn(),
            })
         );
         expect(html).toContain(`data-image-purpose="${purpose}"`);
         expect(html).toContain(`alt="${label} preview"`);
         expect(html).toContain(`aria-label="Replace ${label}"`);
         expect(html).toContain(`src="${url}"`);
         expect(html).toContain(shape);
         expect(html).toContain(helper);
         expect(html).toContain(`Loading ${label} preview`);
         expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
         expect(html).toContain("up to 3 MB");
      }
   );

   it("renders an accessible empty/error state without a clear control", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeImageInput, {
            purpose: "event-banner",
            value: null,
            onChange: vi.fn(),
            error: "Please upload an event header image.",
            disabled: true,
         })
      );
      expect(html).not.toContain("<img");
      expect(html).toContain('aria-label="Upload Event Header Image"');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('role="alert"');
      expect(html).toContain("disabled");
      expect(html).not.toContain("Clear image");
   });

   it("recovers a failed preview through its purpose-specific retry button", () => {
      const tree = liveRender(() =>
         ChallengeImageInput({
            purpose: "event-banner",
            value: banner,
            onChange: vi.fn(),
         })
      );
      const preview = find(tree, (element) => element.props.src === banner);
      mocks.slots = [];
      const render = () =>
         (preview.type as (props: typeof preview.props) => ReactElement)(
            preview.props
         );
      let previewTree = liveRender(render);
      find(
         previewTree,
         (element) => typeof element.props.onError === "function"
      ).props.onError();
      previewTree = liveRender(render);
      expect(previewTree.props["aria-label"]).toBe(
         "Retry Event Header Image preview"
      );
      previewTree.props.onClick();
      previewTree = liveRender(render);
      expect(
         find(
            previewTree,
            (element) =>
               element.props["aria-label"] ===
               "Loading Event Header Image preview"
         )
      ).toBeDefined();
   });

   it("supports an optional accessible label", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeImageInput, {
            purpose: "punishment-pfp",
            value: pfp,
            onChange: vi.fn(),
            label: "Weekly avatar",
         })
      );
      expect(html).toContain('alt="Weekly avatar preview"');
      expect(html).toContain('aria-label="Replace Weekly avatar"');
   });
});

describe("ChallengeImageInput upload callbacks", () => {
   it.each(["event-banner", "punishment-pfp"] as const)(
      "sends file and %s purpose and discards only a replaced unsaved upload",
      async (purpose) => {
         const onChange = vi.fn();
         const onBusyChange = vi.fn();
         const uploaded = deferred<{ ok: true; data: { url: string } }>();
         mocks.upload.mockReturnValue(uploaded.promise);
         const createUrl = vi
            .spyOn(URL, "createObjectURL")
            .mockReturnValue("blob:local-preview");
         try {
            const render = () =>
               ChallengeImageInput({
                  purpose,
                  value: "https://example.test/unsaved.png",
                  savedValue: pfp,
                  onChange,
                  onBusyChange,
               });
            let tree = liveRender(render);
            const file = new File(["image"], "image.png", {
               type: "image/png",
            });
            find(tree, (element) => element.type === "input").props.onChange({
               target: { files: [file], value: "image.png" },
            });
            const data = mocks.upload.mock.calls[0][0] as FormData;
            expect(data.get("purpose")).toBe(purpose);
            expect(data.get("file")).toBeInstanceOf(File);
            expect(onBusyChange).toHaveBeenCalledWith(true);
            tree = liveRender(render);
            expect(
               find(tree, (element) => element.type === "input").props.disabled
            ).toBe(true);
            expect(
               find(
                  tree,
                  (element) => element.props.src === "blob:local-preview"
               )
            ).toBeDefined();
            uploaded.resolve({ ok: true, data: { url: banner } });
            await vi.waitFor(() =>
               expect(onChange).toHaveBeenCalledWith(banner)
            );
            expect(mocks.discard).toHaveBeenCalledWith(
               "https://example.test/unsaved.png"
            );
            expect(onBusyChange).toHaveBeenLastCalledWith(false);
         } finally {
            createUrl.mockRestore();
         }
      }
   );

   it("preserves a saved image on replacement and retains retry after upload failure", async () => {
      const onChange = vi.fn();
      mocks.upload.mockResolvedValueOnce({
         ok: false,
         message: "Storage unavailable",
      });
      const createUrl = vi
         .spyOn(URL, "createObjectURL")
         .mockReturnValue("blob:preview");
      try {
         const render = () =>
            ChallengeImageInput({
               purpose: "punishment-pfp",
               value: pfp,
               savedValue: pfp,
               onChange,
            });
         let tree = liveRender(render);
         find(tree, (element) => element.type === "input").props.onChange({
            target: {
               files: [
                  new File(["image"], "avatar.png", { type: "image/png" }),
               ],
               value: "",
            },
         });
         await vi.waitFor(() =>
            expect(mocks.slots).toContain("Storage unavailable")
         );
         expect(onChange).not.toHaveBeenCalled();
         tree = liveRender(render);
         find(
            tree,
            (element) =>
               element.props["aria-label"] ===
               "Retry Assigned Punishment PFP upload"
         ).props.onClick();
         await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(pfp));
         expect(mocks.discard).not.toHaveBeenCalled();
      } finally {
         createUrl.mockRestore();
      }
   });

   it("rejects oversized and unsupported files without starting uploads", () => {
      const render = () =>
         ChallengeImageInput({
            purpose: "event-banner",
            value: null,
            onChange: vi.fn(),
         });
      let tree = liveRender(render);
      find(tree, (element) => element.type === "input").props.onChange({
         target: {
            files: [{ type: "image/png", size: 3 * 1024 * 1024 + 1 }],
            value: "",
         },
      });
      expect(mocks.slots).toContain("Image must be 3 MB or smaller.");
      tree = liveRender(render);
      find(tree, (element) => element.type === "input").props.onChange({
         target: { files: [{ type: "image/gif", size: 10 }], value: "" },
      });
      expect(mocks.slots).toContain(
         "Only PNG, JPEG or WebP images are allowed."
      );
      expect(mocks.upload).not.toHaveBeenCalled();
   });
});

describe("independent challenge form fields", () => {
   it("renders both fields in the wizard and uses raw saved images in Manage", () => {
      const wizardHtml = renderToStaticMarkup(
         createElement(ChallengeCreatorWizard)
      );
      const manageHtml = renderToStaticMarkup(
         createElement(ChallengeManageTab, { challenge })
      );
      for (const html of [wizardHtml, manageHtml]) {
         expect(html).toContain('data-image-purpose="event-banner"');
         expect(html).toContain('data-image-purpose="punishment-pfp"');
      }
      expect(manageHtml).toContain(`src="${banner}"`);
      expect(manageHtml).toContain(`src="${pfp}"`);
      expect(manageHtml).not.toContain("/fallback-avatar.png");
      expect(manageHtml).not.toContain("/display-banner.png");
   });

   it("requires both wizard images and submits them separately", async () => {
      let tree = liveRender(ChallengeCreatorWizard);
      tree.props.onSubmit({ preventDefault: vi.fn() });
      expect(mocks.create).not.toHaveBeenCalled();
      tree = liveRender(ChallengeCreatorWizard);
      expect(image(tree, "event-banner").props.error).toBeTruthy();
      expect(image(tree, "punishment-pfp").props.error).toBeTruthy();
      image(tree, "event-banner").props.onChange(banner);
      tree = liveRender(ChallengeCreatorWizard);
      tree.props.onSubmit({ preventDefault: vi.fn() });
      expect(mocks.create).not.toHaveBeenCalled();
      image(tree, "punishment-pfp").props.onChange(pfp);
      tree = liveRender(ChallengeCreatorWizard);
      tree.props.onSubmit({ preventDefault: vi.fn() });
      await vi.waitFor(() =>
         expect(mocks.create).toHaveBeenCalledWith(
            expect.objectContaining({
               eventBannerUrl: banner,
               punishmentPfpUrl: pfp,
            })
         )
      );
   });

   it.each(["event-banner", "punishment-pfp"] as const)(
      "blocks wizard submit/cancel while %s uploads",
      (purpose) => {
         let tree = liveRender(ChallengeCreatorWizard);
         image(tree, purpose).props.onBusyChange(true);
         tree = liveRender(ChallengeCreatorWizard);
         tree.props.onSubmit({ preventDefault: vi.fn() });
         button(tree, "Cancel").props.onClick();
         expect(button(tree, "Cancel").props.disabled).toBe(true);
         expect(mocks.create).not.toHaveBeenCalled();
         expect(mocks.back).not.toHaveBeenCalled();
      }
   );

   it("blocks wizard cancel and repeat submit throughout an asynchronous create", async () => {
      const created = deferred<{ ok: true; data: { challengeId: string } }>();
      mocks.create.mockReturnValue(created.promise);
      let tree = liveRender(ChallengeCreatorWizard);
      image(tree, "event-banner").props.onChange(banner);
      image(tree, "punishment-pfp").props.onChange(pfp);
      tree = liveRender(ChallengeCreatorWizard);
      tree.props.onSubmit({ preventDefault: vi.fn() });
      tree = liveRender(ChallengeCreatorWizard);
      expect(button(tree, "Cancel").props.disabled).toBe(true);
      button(tree, "Cancel").props.onClick();
      tree.props.onSubmit({ preventDefault: vi.fn() });
      expect(mocks.back).not.toHaveBeenCalled();
      expect(mocks.discard).not.toHaveBeenCalled();
      expect(mocks.create).toHaveBeenCalledTimes(1);
      created.resolve({ ok: true, data: { challengeId: "new-challenge" } });
      await vi.waitFor(() =>
         expect(mocks.push).toHaveBeenCalledWith("/challenge/new-challenge")
      );
   });

   it("discards both wizard uploads on cancel", () => {
      let tree = liveRender(ChallengeCreatorWizard);
      image(tree, "event-banner").props.onChange(banner);
      image(tree, "punishment-pfp").props.onChange(pfp);
      tree = liveRender(ChallengeCreatorWizard);
      button(tree, "Cancel").props.onClick();
      expect(mocks.discard.mock.calls).toEqual([[banner], [pfp]]);
      expect(mocks.back).toHaveBeenCalled();
   });

   it.each(["event-banner", "punishment-pfp"] as const)(
      "blocks Manage reset/save while %s uploads",
      (purpose) => {
         const render = () => ChallengeManageTab({ challenge });
         let tree = liveRender(render);
         image(tree, purpose).props.onBusyChange(true);
         tree = liveRender(render);
         expect(button(tree, "Cancel").props.disabled).toBe(true);
         button(tree, "Cancel").props.onClick();
         const save = find(
            tree,
            (element) =>
               element.type === Button &&
               element.props.onClick?.name === "handleSaveChallenge"
         );
         expect(save.props.disabled).toBe(true);
         save.props.onClick();
         expect(mocks.update).not.toHaveBeenCalled();
         expect(mocks.discard).not.toHaveBeenCalled();
      }
   );

   it.each([
      [null, null],
      ["", ""],
      [" \t ", "\n "],
      [` ${banner} `, ` ${pfp} `],
   ] as const)(
      "preserves raw legacy images (%j, %j) on unrelated saves",
      async (eventBannerUrl, punishmentPfpUrl) => {
         const legacy = { ...challenge, eventBannerUrl, punishmentPfpUrl };
         const tree = liveRender(() =>
            ChallengeManageTab({ challenge: legacy })
         );
         expect(image(tree, "event-banner").props.value).toBe(eventBannerUrl);
         expect(image(tree, "event-banner").props.savedValue).toBe(
            eventBannerUrl
         );
         expect(image(tree, "punishment-pfp").props.value).toBe(
            punishmentPfpUrl
         );
         find(
            tree,
            (element) =>
               element.type === Button &&
               element.props.onClick?.name === "handleSaveChallenge"
         ).props.onClick();
         await vi.waitFor(() =>
            expect(mocks.update).toHaveBeenCalledWith(
               expect.objectContaining({ eventBannerUrl, punishmentPfpUrl })
            )
         );
         expect(mocks.refresh).toHaveBeenCalled();
         expect(mocks.discard).not.toHaveBeenCalled();
      }
   );

   it.each([null, "", " \t ", ` ${banner} `])(
      "resets a replaced banner to its exact raw saved value %j",
      (eventBannerUrl) => {
         const legacy = { ...challenge, eventBannerUrl };
         const render = () => ChallengeManageTab({ challenge: legacy });
         let tree = liveRender(render);
         image(tree, "event-banner").props.onChange(
            "https://example.test/new-banner.png"
         );
         tree = liveRender(render);
         button(tree, "Cancel").props.onClick();
         tree = liveRender(render);
         expect(image(tree, "event-banner").props.value).toBe(eventBannerUrl);
         expect(image(tree, "event-banner").props.savedValue).toBe(
            eventBannerUrl
         );
         expect(mocks.discard.mock.calls).toEqual([
            ["https://example.test/new-banner.png"],
         ]);
      }
   );

   it("resets both unsaved Manage images without discarding saved values", () => {
      const render = () => ChallengeManageTab({ challenge });
      let tree = liveRender(render);
      image(tree, "event-banner").props.onChange(
         "https://example.test/new-banner.png"
      );
      image(tree, "punishment-pfp").props.onChange(
         "https://example.test/new-avatar.png"
      );
      tree = liveRender(render);
      button(tree, "Cancel").props.onClick();
      tree = liveRender(render);
      expect(image(tree, "event-banner").props.value).toBe(banner);
      expect(image(tree, "punishment-pfp").props.value).toBe(pfp);
      expect(mocks.discard.mock.calls).toEqual([
         ["https://example.test/new-banner.png"],
         ["https://example.test/new-avatar.png"],
      ]);
      expect(image(tree, "event-banner").key).toBe("event-banner-1");
      expect(image(tree, "punishment-pfp").key).toBe("punishment-pfp-1");
   });

   it("blocks reset during save and protects newly saved images before refresh completes", async () => {
      const saved = deferred<{ ok: true }>();
      mocks.update.mockReturnValue(saved.promise);
      const render = () => ChallengeManageTab({ challenge });
      let tree = liveRender(render);
      image(tree, "event-banner").props.onChange(
         "https://example.test/new-banner.png"
      );
      tree = liveRender(render);
      find(
         tree,
         (element) =>
            element.type === Button &&
            element.props.onClick?.name === "handleSaveChallenge"
      ).props.onClick();
      tree = liveRender(render);
      expect(button(tree, "Cancel").props.disabled).toBe(true);
      button(tree, "Cancel").props.onClick();
      expect(mocks.discard).not.toHaveBeenCalled();
      saved.resolve({ ok: true });
      await vi.waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
      tree = liveRender(render);
      button(tree, "Cancel").props.onClick();
      expect(mocks.discard).not.toHaveBeenCalled();
   });
});
