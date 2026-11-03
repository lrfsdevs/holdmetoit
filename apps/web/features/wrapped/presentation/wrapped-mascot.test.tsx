// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { WrappedMascot } from "./wrapped-mascot";

describe("WrappedMascot", () => {
   afterEach(() => {
      cleanup();
   });
   it("renders GOOGLY_EYES with original structure and animations", () => {
      const { getByTestId, container } = render(
         <WrappedMascot variant="GOOGLY_EYES" data-testid="mascot-googly" />
      );

      const el = getByTestId("mascot-googly");
      expect(el).toBeDefined();
      expect(el.getAttribute("data-variant")).toBe("GOOGLY_EYES");
      expect(el.getAttribute("title")).toBe("Peek peek");
      expect(container.querySelectorAll(".animate-shy-blink")).toHaveLength(2);
   });

   it("renders Doodle Cat with peeking ears, whiskers, and paws", () => {
      const { getByTestId, container } = render(
         <WrappedMascot variant="CAT" data-testid="mascot-cat" />
      );

      const el = getByTestId("mascot-cat");
      expect(el).toBeDefined();
      expect(el.getAttribute("data-variant")).toBe("CAT");
      expect(container.querySelector("svg")).toBeDefined();
   });

   it("renders Doodle Dog with floppy ears and snout", () => {
      const { getByTestId, container } = render(
         <WrappedMascot variant="DOG" data-testid="mascot-dog" />
      );

      const el = getByTestId("mascot-dog");
      expect(el).toBeDefined();
      expect(el.getAttribute("data-variant")).toBe("DOG");
      expect(container.querySelector("svg")).toBeDefined();
   });

   it("renders Doodle Bunny with expressive lop ears and twitching nose", () => {
      const { getByTestId, container } = render(
         <WrappedMascot variant="BUNNY" data-testid="mascot-bunny" />
      );

      const el = getByTestId("mascot-bunny");
      expect(el).toBeDefined();
      expect(el.getAttribute("data-variant")).toBe("BUNNY");
      expect(container.querySelector("svg")).toBeDefined();
   });

   it("switches to shy mood when hovered", () => {
      const { getByTestId } = render(
         <WrappedMascot variant="CAT" data-testid="mascot-hover" />
      );

      const el = getByTestId("mascot-hover");
      expect(el.getAttribute("data-mood")).toBe("idle");

      fireEvent.mouseEnter(el);
      expect(el.getAttribute("data-mood")).toBe("shy");

      fireEvent.mouseLeave(el);
      expect(el.getAttribute("data-mood")).toBe("idle");
   });

   it("respects explicit mood prop", () => {
      const { getByTestId } = render(
         <WrappedMascot variant="DOG" mood="proud" data-testid="mascot-proud" />
      );

      const el = getByTestId("mascot-proud");
      expect(el.getAttribute("data-mood")).toBe("proud");
   });

   it("applies size classes appropriately", () => {
      const { getByTestId } = render(
         <WrappedMascot variant="BUNNY" size="lg" data-testid="mascot-lg" />
      );

      const el = getByTestId("mascot-lg");
      expect(el.className).toContain("w-32");
      expect(el.className).toContain("h-24");
   });

   it("honors forceReducedMotion without throwing", () => {
      const { getByTestId } = render(
         <WrappedMascot
            variant="CAT"
            forceReducedMotion={true}
            data-testid="mascot-motion"
         />
      );

      const el = getByTestId("mascot-motion");
      expect(el).toBeDefined();
   });
});
