// @vitest-environment jsdom
import { createElement } from "react";
import {
   afterEach,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { discardFeedbackAttachmentAction, uploadFeedbackAttachment } =
   vi.hoisted(() => ({
      discardFeedbackAttachmentAction: vi.fn(),
      uploadFeedbackAttachment: vi.fn(),
   }));

vi.mock("@/features/feedback/api/feedback-attachments.actions", () => ({
   discardFeedbackAttachmentAction,
   requestFeedbackAttachmentUploadAction: vi.fn(),
   confirmFeedbackAttachmentAction: vi.fn(),
}));

vi.mock("./upload-feedback-attachment", () => ({
   uploadFeedbackAttachment,
}));

import {
   FeedbackAttachmentInput,
   type DraftFeedbackAttachment,
} from "./feedback-attachment-input";

let nextId = 0;

function draft(
   overrides: Partial<DraftFeedbackAttachment> = {}
): DraftFeedbackAttachment {
   nextId += 1;
   const fileName = overrides.fileName ?? `shot-${nextId}.png`;
   return {
      id: `draft-${nextId}`,
      fileName,
      sizeBytes: 1024,
      kind: "image",
      localUrl: "blob:test",
      path: null,
      url: null,
      status: "ready",
      progress: 100,
      error: null,
      file: new File([], fileName, { type: "image/png" }),
      ...overrides,
   };
}

beforeAll(() => {
   if (!("createObjectURL" in URL)) {
      Object.defineProperty(URL, "createObjectURL", {
         value: vi.fn(() => "blob:test"),
         writable: true,
      });
   }
   if (!("revokeObjectURL" in URL)) {
      Object.defineProperty(URL, "revokeObjectURL", {
         value: vi.fn(),
         writable: true,
      });
   }
});

beforeEach(() => {
   vi.clearAllMocks();
   discardFeedbackAttachmentAction.mockResolvedValue({ ok: true });
   uploadFeedbackAttachment.mockResolvedValue({
      path: "feedback-attachments/abc.png",
      url: "https://cdn.example.com/abc.png",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 1024,
   });
});

afterEach(() => {
   cleanup();
});

describe("FeedbackAttachmentInput", () => {
   it("renders the upload control and format guidance", () => {
      render(
         createElement(FeedbackAttachmentInput, {
            attachments: [],
            onChange: vi.fn(),
         })
      );

      expect(
         screen.getByRole("button", { name: /add image or video/i })
      ).toBeTruthy();
      expect(screen.getByText(/PNG, JPEG, WebP, GIF up to 5 MB/)).toBeTruthy();
      expect(screen.getByText("0/3")).toBeTruthy();
   });

   it("disables adding files at the limit", () => {
      const attachments = [draft(), draft(), draft()];
      render(
         createElement(FeedbackAttachmentInput, {
            attachments,
            onChange: vi.fn(),
         })
      );

      const addButton = screen.getByRole("button", {
         name: /add image or video/i,
      }) as HTMLButtonElement;
      expect(addButton.disabled).toBe(true);
      expect(screen.getByText("3/3")).toBeTruthy();
   });

   it("renders image and video previews", () => {
      render(
         createElement(FeedbackAttachmentInput, {
            attachments: [
               draft({ fileName: "shot.png", kind: "image" }),
               draft({
                  fileName: "clip.mp4",
                  kind: "video",
                  file: new File([], "clip.mp4", { type: "video/mp4" }),
               }),
            ],
            onChange: vi.fn(),
         })
      );

      expect(screen.getByAltText("Preview of shot.png")).toBeTruthy();
      expect(screen.getByLabelText("Preview of clip.mp4")).toBeTruthy();
   });

   it("removes an attachment and discards its stored object", () => {
      const keep = draft({ fileName: "keep.png" });
      const remove = draft({
         fileName: "remove.png",
         path: "feedback-attachments/remove.png",
      });
      const onChange = vi.fn();

      render(
         createElement(FeedbackAttachmentInput, {
            attachments: [keep, remove],
            onChange,
         })
      );

      fireEvent.click(
         screen.getByRole("button", { name: /remove remove.png/i })
      );

      expect(discardFeedbackAttachmentAction).toHaveBeenCalledWith({
         path: "feedback-attachments/remove.png",
      });

      const updater = onChange.mock.calls[0][0] as (
         current: DraftFeedbackAttachment[]
      ) => DraftFeedbackAttachment[];
      expect(updater([keep, remove])).toEqual([keep]);
   });

   it("shows failed uploads with a retry action", () => {
      const failed = draft({
         fileName: "broken.png",
         status: "error",
         error: "Upload failed.",
      });

      render(
         createElement(FeedbackAttachmentInput, {
            attachments: [failed],
            onChange: vi.fn(),
         })
      );

      expect(screen.getByRole("alert").textContent).toContain("Upload failed.");

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
      expect(uploadFeedbackAttachment).toHaveBeenCalledWith(
         failed.file,
         expect.any(Object)
      );
   });
});
