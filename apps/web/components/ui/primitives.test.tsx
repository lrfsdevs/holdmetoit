// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Switch } from "./switch";
import { Progress } from "./progress";
import { Avatar, AvatarFallback } from "./avatar";
import { Separator } from "./separator";
import { Label } from "./label";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Skeleton } from "./skeleton";
import { Input } from "./input";

afterEach(cleanup);

describe("UI primitives", () => {
   it("Tabs switches the active trigger and panel", () => {
      render(
         <Tabs defaultValue="one">
            <TabsList>
               <TabsTrigger value="one">One</TabsTrigger>
               <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
            <TabsContent value="one">Panel one</TabsContent>
            <TabsContent value="two">Panel two</TabsContent>
         </Tabs>
      );

      const tab = screen.getByRole("tab", { name: "Two" });
      fireEvent.mouseDown(tab, { button: 0 });

      expect(
         screen.getByRole("tab", { name: "Two" }).getAttribute("aria-selected")
      ).toBe("true");
      expect(screen.getByText("Panel two")).toBeTruthy();
   });

   it("Switch toggles aria-checked", () => {
      render(<Switch aria-label="Enable" />);
      const sw = screen.getByRole("switch");

      expect(sw.getAttribute("aria-checked")).toBe("false");
      fireEvent.click(sw);
      expect(sw.getAttribute("aria-checked")).toBe("true");
   });

   it("Progress exposes value and max", () => {
      render(<Progress value={40} max={100} aria-label="Progress" />);
      const bar = screen.getByRole("progressbar");

      expect(bar.getAttribute("aria-valuenow")).toBe("40");
      expect(bar.getAttribute("aria-valuemax")).toBe("100");
   });

   it("Avatar falls back when no image is available", () => {
      render(
         <Avatar>
            <AvatarFallback>AF</AvatarFallback>
         </Avatar>
      );

      expect(screen.getByText("AF")).toBeTruthy();
   });

   it("Alert renders title and description with role=alert", () => {
      render(
         <Alert variant="destructive">
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Something failed.</AlertDescription>
         </Alert>
      );

      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Heads up")).toBeTruthy();
      expect(screen.getByText("Something failed.")).toBeTruthy();
   });

   it("RadioGroup marks the selected item checked", () => {
      render(
         <RadioGroup defaultValue="a" aria-label="Choice">
            <RadioGroupItem value="a" aria-label="A" />
            <RadioGroupItem value="b" aria-label="B" />
         </RadioGroup>
      );

      const b = screen.getByLabelText("B");
      fireEvent.click(b);
      expect(b.getAttribute("data-state")).toBe("checked");
   });

   it("Label associates with an input", () => {
      render(
         <>
            <Label htmlFor="probe-input">Name</Label>
            <Input id="probe-input" />
         </>
      );

      expect(screen.getByLabelText("Name").tagName).toBe("INPUT");
   });

   it("Separator renders with its role", () => {
      render(<Separator decorative={false} />);
      expect(screen.getByRole("separator")).toBeTruthy();
   });

   it("Skeleton is hidden from assistive technology", () => {
      const { container } = render(<Skeleton className="h-4 w-20" />);
      expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
         "true"
      );
   });
});
