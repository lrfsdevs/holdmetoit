// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import {
   identifyLogRocketUser,
   initLogRocket,
} from "@/core/observability/logrocket";
import {
   isLogRocketEnabled,
   setLogRocketEnabled,
} from "@/core/observability/logrocket-config";
import { LogRocketProvider } from "./logrocket-provider";

vi.mock("@/core/observability/logrocket", () => ({
   initLogRocket: vi.fn(),
   identifyLogRocketUser: vi.fn(),
}));

vi.mock("@/core/observability/logrocket-config", () => ({
   isLogRocketEnabled: vi.fn(),
   setLogRocketEnabled: vi.fn(),
}));

const user = {
   id: "u_1",
   name: "Alice",
   displayName: "Alice Scholar",
   role: "PARTICIPANT",
   discordId: "123456789",
};

afterEach(cleanup);

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(isLogRocketEnabled).mockReturnValue(true);
});

describe("LogRocketProvider", () => {
   it("applies the flag without initializing when disabled", () => {
      render(<LogRocketProvider enabled={false} user={user} />);

      expect(setLogRocketEnabled).toHaveBeenCalledWith(false);
      expect(initLogRocket).not.toHaveBeenCalled();
      expect(identifyLogRocketUser).not.toHaveBeenCalled();
   });

   it("initializes when enabled flips from false to true", () => {
      const { rerender } = render(<LogRocketProvider enabled={false} />);

      expect(initLogRocket).not.toHaveBeenCalled();

      rerender(<LogRocketProvider enabled={true} />);

      expect(initLogRocket).toHaveBeenCalledTimes(1);
   });

   it("identifies the user with the existing traits", () => {
      render(<LogRocketProvider enabled={true} user={user} />);

      expect(identifyLogRocketUser).toHaveBeenCalledWith("u_1", {
         name: "Alice Scholar",
         role: "PARTICIPANT",
         discordId: "123456789",
      });
   });

   it("does not initialize again when disabled after initialization", () => {
      const { rerender } = render(<LogRocketProvider enabled={true} />);

      expect(initLogRocket).toHaveBeenCalledTimes(1);

      rerender(<LogRocketProvider enabled={false} />);

      expect(initLogRocket).toHaveBeenCalledTimes(1);
      expect(setLogRocketEnabled).toHaveBeenLastCalledWith(false);
   });
});
