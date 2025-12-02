import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'line' | 'circle' | 'rect' | 'avatar' | 'text';
  width?: string | number;
  height?: string | number;
  count?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  variant = 'rect',
  width,
  height,
  count = 1
}) => {
  // Define variant-specific classes
  const variantClasses = {
    line: 'h-4 w-full rounded',
    circle: 'h-10 w-10 rounded-full',
    rect: 'h-16 w-full rounded',
    avatar: 'h-12 w-12 rounded-full',
    text: 'h-4 w-3/4 rounded',
  };

  // Calculate styles
  const style = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md',
            variantClasses[variant],
            className
          )}
          style={style}
        />
      ))}
    </div>
  );
};

export { SkeletonLoader };