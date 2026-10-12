import fs from "node:fs";
import path from "node:path";

import {
   parseChangelogMarkdown,
   type ChangelogGroup,
} from "@/features/changelog/domain/changelog";

export function getChangelogGroups(): ChangelogGroup[] {
   try {
      const filePath = path.join(process.cwd(), "CHANGELOG.md");
      return parseChangelogMarkdown(fs.readFileSync(filePath, "utf8"));
   } catch {
      return [];
   }
}
