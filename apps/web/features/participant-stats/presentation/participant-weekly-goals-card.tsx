import { CheckCircle2, Circle, ListTodo, Target } from "lucide-react";
import type { ParticipantWeeklyGoalItem } from "../domain/participant-stats.types";

export interface ParticipantWeeklyGoalsCardProps {
   weeklyGoals: ParticipantWeeklyGoalItem[];
   completedGoalsCount: number;
   totalGoalsCount: number;
   className?: string;
}

export function ParticipantWeeklyGoalsCard({
   weeklyGoals,
   completedGoalsCount,
   totalGoalsCount,
   className = "",
}: ParticipantWeeklyGoalsCardProps) {
   const hasGoals = totalGoalsCount > 0;
   const isAllCompleted = hasGoals && completedGoalsCount === totalGoalsCount;

   return (
      <div
         className={`rounded-3xl border border-border-default bg-surface-primary p-5 sm:p-7 shadow-xl space-y-4 ${className}`}
         data-testid="participant-weekly-goals-card"
      >
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-default">
            <div className="flex items-center gap-2">
               <Target className="h-5 w-5 text-feedback-info" />
               <h2 className="text-base sm:text-lg font-bold text-text-primary">
                  Challenge Weekly Goals
               </h2>
            </div>

            <span
               className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                  isAllCompleted
                     ? "bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text"
                     : "bg-surface-elevated border-border-strong text-text-secondary"
               }`}
               data-testid="weekly-goals-completion-pill"
            >
               {completedGoalsCount}/{totalGoalsCount} Goals Completed
            </span>
         </div>

         {!hasGoals ? (
            <div
               className="rounded-2xl border border-dashed border-border-default bg-surface-tertiary/40 p-6 sm:p-8 text-center space-y-2"
               data-testid="weekly-goals-empty-state"
            >
               <ListTodo className="h-8 w-8 text-text-tertiary mx-auto opacity-70" />
               <p className="text-sm font-semibold text-text-secondary">
                  No Challenge Goals Declared
               </p>
               <p className="text-xs text-text-tertiary max-w-sm mx-auto">
                  This scholar has not declared any challenge-linked weekly
                  goals for this event.
               </p>
            </div>
         ) : (
            <ul className="space-y-2.5" data-testid="weekly-goals-list">
               {weeklyGoals.map((goal) => {
                  const isCompleted = goal.isComplete;
                  return (
                     <li
                        key={goal.id}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-tertiary border border-border-default hover:border-border-strong transition-colors"
                        data-testid={`weekly-goal-item-${goal.id}`}
                     >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                           {isCompleted ? (
                              <CheckCircle2
                                 className="h-5 w-5 text-feedback-success shrink-0"
                                 data-testid={`goal-completed-icon-${goal.id}`}
                              />
                           ) : (
                              <Circle
                                 className="h-5 w-5 text-text-tertiary shrink-0"
                                 data-testid={`goal-pending-icon-${goal.id}`}
                              />
                           )}
                           <span
                              className={`text-sm font-medium break-words ${
                                 isCompleted
                                    ? "text-text-secondary line-through"
                                    : "text-text-primary"
                              }`}
                           >
                              {goal.title}
                           </span>
                        </div>

                        {isCompleted && (
                           <span className="shrink-0 text-caption font-semibold text-feedback-success-text px-2 py-0.5 rounded-md bg-feedback-success-bg border border-feedback-success/30">
                              Done
                           </span>
                        )}
                     </li>
                  );
               })}
            </ul>
         )}
      </div>
   );
}
