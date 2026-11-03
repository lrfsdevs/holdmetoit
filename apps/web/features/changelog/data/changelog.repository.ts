import fs from "node:fs";
import path from "node:path";

import {
   parseChangelogMarkdown,
   type ChangelogGroup,
} from "@/features/changelog/domain/changelog";

export function getChangelogGroups(): ChangelogGroup[] {
   const candidatePaths = [
      path.join(process.cwd(), "CHANGELOG.md"),
      path.resolve(process.cwd(), "../../CHANGELOG.md"),
      path.resolve(process.cwd(), "../CHANGELOG.md"),
   ];

   for (const filePath of candidatePaths) {
      try {
         if (fs.existsSync(filePath)) {
            return parseChangelogMarkdown(fs.readFileSync(filePath, "utf8"));
         }
      } catch {
         // Continue searching candidate paths
      }
   }

   return [];
}
