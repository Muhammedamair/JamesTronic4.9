import React from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  brandId: string;
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ brandId, className }) => {
  // Fallback component for when brand logos aren't available
  const brandInitials = brandId.charAt(0).toUpperCase() + brandId.slice(1, 3);
  
  return (
    <div className={cn(
      "flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs",
      className
    )}>
      {brandInitials}
    </div>
  );
};

export { BrandLogo };