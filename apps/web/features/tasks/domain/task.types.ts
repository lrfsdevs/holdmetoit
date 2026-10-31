export type TaskType = "DAILY" | "WEEKLY";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CROSSED_OUT";

export interface TaskItem {
   id: string;
   userId: string;
   categoryId: string;
   challengeId?: string | null;
   title: string;
   taskType: TaskType;
   sortOrder?: number;
   isComplete: boolean;
   status?: TaskStatus;
   dueDate?: string | null;
   isDeleted?: boolean;
   deletionTime?: Date | string | null;
   createdAt: Date;
   updatedAt: Date;
   completedAt: Date | null;
   revision?: number;
}

export interface CategoryItem {
   id: string;
   userId: string;
   name: string;
   taskType: TaskType;
   sortOrder?: number;
   isDeleted?: boolean;
   deletionTime?: Date | string | null;
   createdAt: Date;
   updatedAt: Date;
   revision?: number;
}

export interface CategoryGroup {
   id: string;
   name: string;
   taskType: TaskType;
   sortOrder?: number;
   isCollapsed: boolean;
   isDeleted?: boolean;
   deletionTime?: Date | string | null;
   createdAt?: Date | string;
   updatedAt?: Date | string;
   tasks: TaskItem[];
}

export interface UserCategorizedTasks {
   categories: CategoryItem[];
   dailyCategories: CategoryGroup[];
   weeklyCategories: CategoryGroup[];
   totalDailyTasks: number;
   completedDailyTasks: number;
   totalWeeklyTasks: number;
   completedWeeklyTasks: number;
}
