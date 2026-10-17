import { describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "./page";

vi.mock("@/features/admin/presentation/admin-console-view", () => ({
   AdminConsoleView: () => (
      <div data-testid="admin-console-view">Admin Console</div>
   ),
}));

describe("AdminDashboardPage", () => {
   it("renders the AdminConsoleView component", () => {
      const page = AdminDashboardPage();
      expect(page).toBeDefined();
   });
});
