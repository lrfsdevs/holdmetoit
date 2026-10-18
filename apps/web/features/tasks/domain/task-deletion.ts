const CATEGORY_NAME_MAX_LENGTH = 255;

/**
 * Builds a unique tombstone name for a soft-deleted category so the original
 * name can be re-created without tripping the (userId, name, taskType) unique index.
 */
export function buildCategoryTombstoneName(name: string, id: string): string {
   const suffix = ` ·deleted·${id.slice(0, 8)}`;
   const maxBaseLength = Math.max(0, CATEGORY_NAME_MAX_LENGTH - suffix.length);
   return `${name.slice(0, maxBaseLength)}${suffix}`;
}
