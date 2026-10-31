export default function AdminUsersLoading() {
   return (
      <div className="space-y-6 animate-pulse">
         {/* Top Header Skeleton */}
         <div className="h-20 w-full rounded-3xl bg-surface-primary border border-border-default" />

         {/* 4 Summary Stat Cards */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="h-24 rounded-2xl bg-surface-primary border border-border-default" />
            <div className="h-24 rounded-2xl bg-surface-primary border border-border-default" />
            <div className="h-24 rounded-2xl bg-surface-primary border border-border-default" />
            <div className="h-24 rounded-2xl bg-surface-primary border border-border-default" />
         </div>

         {/* Filter Bar Skeleton */}
         <div className="h-16 w-full rounded-2xl bg-surface-primary border border-border-default" />

         {/* Table Skeleton */}
         <div className="h-96 rounded-3xl bg-surface-primary border border-border-default" />
      </div>
   );
}
