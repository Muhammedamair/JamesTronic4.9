import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div 
      className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-gray-700", className)} 
    />
  );
};

export { Skeleton };