import { Fragment } from "react";
import { ExternalLink } from "lucide-react";

import {
   parseChallengeDescription,
   resolveChallengeDescription,
   type DescriptionInline,
} from "@/features/challenges/domain/challenge-description";
import { cn } from "@/lib/utils";

interface ChallengeDescriptionContentProps {
   source?: string | null;
   className?: string;
}

function isExternalHref(href: string): boolean {
   return /^https?:\/\//i.test(href);
}

function renderInline(nodes: DescriptionInline[], keyPrefix: string) {
   return nodes.map((node, index) => {
      const key = `${keyPrefix}-${index}`;

      if (node.type === "text") {
         return <Fragment key={key}>{node.value}</Fragment>;
      }

      const external = isExternalHref(node.href);

      return (
         <a
            key={key}
            href={node.href}
            {...(external
               ? { target: "_blank", rel: "noreferrer noopener" }
               : {})}
            className="text-feedback-info hover:underline inline-flex items-center gap-1 font-medium"
         >
            {node.label}
            {external && (
               <ExternalLink className="h-3 w-3 inline" aria-hidden="true" />
            )}
         </a>
      );
   });
}

/** Renders the constrained challenge description syntax safely. */
export function ChallengeDescriptionContent({
   source,
   className,
}: ChallengeDescriptionContentProps) {
   const blocks = parseChallengeDescription(
      resolveChallengeDescription(source)
   );

   return (
      <div
         className={cn(
            "space-y-3 text-sm leading-relaxed text-text-secondary",
            className
         )}
      >
         {blocks.map((block, blockIndex) => {
            if (block.type === "divider") {
               return (
                  <hr
                     key={`divider-${blockIndex}`}
                     className="border-border-default"
                  />
               );
            }

            if (block.type === "heading") {
               const Heading = block.level === 1 ? "h2" : "h3";
               return (
                  <Heading
                     key={`heading-${blockIndex}`}
                     className={
                        block.level === 1
                           ? "text-lg font-bold text-white"
                           : "text-base font-bold text-white"
                     }
                  >
                     {renderInline(block.content, `heading-${blockIndex}`)}
                  </Heading>
               );
            }

            return (
               <p key={`paragraph-${blockIndex}`}>
                  {block.lines.map((line, lineIndex) => (
                     <Fragment key={`line-${blockIndex}-${lineIndex}`}>
                        {lineIndex > 0 && <br />}
                        {renderInline(line, `line-${blockIndex}-${lineIndex}`)}
                     </Fragment>
                  ))}
               </p>
            );
         })}
      </div>
   );
}
