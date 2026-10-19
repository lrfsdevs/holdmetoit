// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChallengeDescriptionEditor } from "./challenge-description-editor";
import { DEFAULT_CHALLENGE_DESCRIPTION } from "@/features/challenges/domain/challenge-description";

afterEach(cleanup);

describe("ChallengeDescriptionEditor", () => {
   it("opens on the rendered preview by default", () => {
      render(
         <ChallengeDescriptionEditor
            id="description"
            value={"# How it works"}
            onChange={vi.fn()}
         />
      );

      expect(screen.queryByRole("textbox")).toBeNull();
      expect(
         screen.getByRole("heading", { name: "How it works" })
      ).toBeTruthy();
   });

   it("renders the textarea and counter after switching to Write", () => {
      render(
         <ChallengeDescriptionEditor
            id="description"
            value="Hello"
            onChange={vi.fn()}
         />
      );

      fireEvent.click(screen.getByRole("button", { name: "Write" }));

      expect(screen.getByRole("textbox")).toBeTruthy();
      expect(screen.getByText("5/5000")).toBeTruthy();
   });

   it("switches back to the rendered preview", () => {
      render(
         <ChallengeDescriptionEditor
            id="description"
            value={"## Details\n\n---\n\n[Link](https://example.com)"}
            onChange={vi.fn()}
         />
      );

      fireEvent.click(screen.getByRole("button", { name: "Write" }));
      fireEvent.click(screen.getByRole("button", { name: "Preview" }));

      expect(screen.getByRole("heading", { name: "Details" })).toBeTruthy();
      expect(screen.getByRole("link", { name: /Link/ })).toBeTruthy();
   });

   it("uses type=button for the mode tabs", () => {
      render(
         <ChallengeDescriptionEditor
            id="description"
            value=""
            onChange={vi.fn()}
         />
      );

      expect(
         screen.getByRole("button", { name: "Preview" }).getAttribute("type")
      ).toBe("button");
      expect(
         screen.getByRole("button", { name: "Write" }).getAttribute("type")
      ).toBe("button");
   });

   it("previews the default body when the value is empty", () => {
      const { container } = render(
         <ChallengeDescriptionEditor
            id="description"
            value=""
            onChange={vi.fn()}
         />
      );

      expect(container.textContent).toContain(
         DEFAULT_CHALLENGE_DESCRIPTION.split("\n")[0]
      );
   });
});
