import { ListStatistics, YjsListItemData } from '@/types/List';

/**
 * Calculate statistics for a list of items
 */
export function calculateListStatistics(
  items: YjsListItemData[]
): ListStatistics {
  const totalItems = items.length;
  const completedItems = items.filter(item => item.isCompleted).length;
  const completionPercentage =
    totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return {
    totalItems,
    completedItems,
    completionPercentage,
  };
}
