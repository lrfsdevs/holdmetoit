import { describe, expect, it, vi } from "vitest";
import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UserDirectoryView } from "./user-directory-view";
import type { AdminUserRosterResult } from "../domain/user-directory.types";

vi.mock("next/link", () => ({
   default: ({
      href,
      children,
      ...rest
   }: {
      href: string;
      children: ReactNode;
   }) => createElement("a", { href, ...rest }, children),
}));

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      className,
   }: {
      src: string;
      alt: string;
      className: string;
   }) => createElement("img", { src, alt, className }),
}));

vi.mock("../api/user-directory.actions", () => ({
   fetchAdminUserRosterAction: vi.fn(),
   updateUserRoleAction: vi.fn(),
   getUserAuditLogsAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("./user-inspector-sheet", () => ({
   UserInspectorSheet: () => null,
}));

describe("UserDirectoryView", () => {
   const mockResult: AdminUserRosterResult = {
      items: [
         {
            id: "usr_alice",
            discordId: "123456789012345678",
            name: "Alice Active",
            discordTag: "alice#0001",
            image: "https://example.com/alice.png",
            role: "USER",
            createdAt: new Date("2026-09-01T00:00:00.000Z").toISOString(),
            lifetimeStudyHours: 24.5,
            trophies: 1250,
            trophyRank: "Diamond",
            walletBalance: 350,
            yptStatus: "CONNECTED",
            activeChallenges: [
               {
                  id: "chal_oct",
                  participantId: "part_alice",
                  title: "October Sprint",
                  mode: "SOLOS",
               },
            ],
            totalChallengesCount: 3,
         },
         {
            id: "usr_bob",
            discordId: "987654321098765432",
            name: "Bob Host",
            discordTag: "bob#0002",
            image: null,
            role: "HOST",
            createdAt: new Date("2026-08-15T00:00:00.000Z").toISOString(),
            lifetimeStudyHours: 80.0,
            trophies: 800,
            trophyRank: "Platinum",
            walletBalance: 1200,
            yptStatus: "DISCONNECTED",
            activeChallenges: [],
            totalChallengesCount: 5,
         },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 15,
      totalPages: 1,
      summary: {
         totalUsers: 50,
         activeEnrolledUsers: 20,
         unenrolledUsers: 30,
         yptConnectedUsers: 15,
      },
   };

   it("renders the summary statistic cards", () => {
      const html = renderToStaticMarkup(
         <UserDirectoryView initialData={mockResult} currentAdminId="admin_1" />
      );

      expect(html).toContain("Total Registered");
      expect(html).toContain("50");
      expect(html).toContain("Active in Battles");
      expect(html).toContain("20");
      expect(html).toContain("Unenrolled / Idle");
      expect(html).toContain("30");
      expect(html).toContain("YPT Connected");
      expect(html).toContain("15");
   });

   it("renders member rows with Discord Snowflake and role badges", () => {
      const html = renderToStaticMarkup(
         <UserDirectoryView initialData={mockResult} currentAdminId="admin_1" />
      );

      // Alice
      expect(html).toContain("Alice Active");
      expect(html).toContain("alice#0001");
      expect(html).toContain("123456789012345678");
      expect(html).toContain("24.5h");
      expect(html).toContain("Diamond");
      expect(html).toContain("October Sprint");
      expect(html).toContain("/challenge/chal_oct/participant/part_alice");

      // Bob
      expect(html).toContain("Bob Host");
      expect(html).toContain("bob#0002");
      expect(html).toContain("987654321098765432");
      expect(html).toContain("80h");
      expect(html).toContain("Platinum");
      expect(html).toContain("Unenrolled");
      expect(html).toContain("/profile/usr_bob");
   });

   it("renders empty state when no users are returned", () => {
      const emptyResult: AdminUserRosterResult = {
         items: [],
         totalCount: 0,
         page: 1,
         pageSize: 15,
         totalPages: 1,
         summary: {
            totalUsers: 0,
            activeEnrolledUsers: 0,
            unenrolledUsers: 0,
            yptConnectedUsers: 0,
         },
      };

      const html = renderToStaticMarkup(
         <UserDirectoryView
            initialData={emptyResult}
            currentAdminId="admin_1"
         />
      );

      expect(html).toContain("No Members Found");
   });

   it("renders pagination footer when totalPages > 1", () => {
      const multiPageResult: AdminUserRosterResult = {
         ...mockResult,
         totalCount: 45,
         totalPages: 3,
      };

      const html = renderToStaticMarkup(
         <UserDirectoryView
            initialData={multiPageResult}
            currentAdminId="admin_1"
         />
      );

      expect(html).toContain("Showing");
      expect(html).toContain("45");
      expect(html).toContain("members");
   });
});
