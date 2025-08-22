import React from 'react';

interface ProgressIndicatorProps {
  completedItems: number;
  totalItems: number;
  showLabel?: boolean;
  showProgressBar?: boolean;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  completedItems,
  totalItems,
  showLabel = true,
  showProgressBar = true,
  className = '',
}) => {
  const completionPercentage =
    totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className={`${className}`}>
      {showLabel && (
        <div className='flex items-center justify-between text-sm text-gray-600 mb-2'>
          <span>Progress</span>
          <span className='font-medium'>
            {completedItems} / {totalItems} completed
          </span>
        </div>
      )}

      {showProgressBar && totalItems > 0 && (
        <div className='w-full bg-gray-200 rounded-full h-2'>
          <div
            className='bg-blue-600 h-2 rounded-full transition-all duration-300'
            style={{
              width: `${completionPercentage}%`,
            }}
          />
        </div>
      )}
    </div>
  );
};
