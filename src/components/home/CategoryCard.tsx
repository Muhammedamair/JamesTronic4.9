'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CategoryCardProps {
    id: string;
    title: string;
    description: string;
    rating?: string;
    reviewCount?: string;
    icon: React.ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
    id,
    title,
    description,
    rating,
    reviewCount,
    icon,
    href,
    onClick,
    className
}) => {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "group flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100",
                "hover:border-gray-200 hover:shadow-lg transition-all duration-300",
                "cursor-pointer",
                className
            )}
        >
            {/* Icon Container */}
            <div className="w-20 h-20 mb-4 flex items-center justify-center">
                {icon}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
                {title}
            </h3>

            {/* Rating */}
            {rating && (
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                    <span className="text-green-600 font-medium">★ {rating}</span>
                    {reviewCount && <span>({reviewCount} reviews)</span>}
                </div>
            )}

            {/* Description */}
            <p className="text-sm text-gray-500 text-center line-clamp-2">
                {description}
            </p>
        </Link>
    );
};

// Isometric 3D Icon Components
export const TVIcon = () => (
    <svg viewBox="0 0 80 80" className="w-full h-full">
        <defs>
            <linearGradient id="tvGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
        </defs>
        {/* TV Frame */}
        <rect x="10" y="15" width="60" height="40" rx="4" fill="url(#tvGradient)" />
        {/* Screen */}
        <rect x="14" y="19" width="52" height="32" rx="2" fill="#1F2937" />
        {/* Screen Reflection */}
        <rect x="16" y="21" width="20" height="15" rx="1" fill="#374151" opacity="0.5" />
        {/* Stand */}
        <rect x="30" y="55" width="20" height="4" rx="1" fill="#9CA3AF" />
        <rect x="25" y="59" width="30" height="3" rx="1" fill="#6B7280" />
    </svg>
);

export const MobileIcon = () => (
    <svg viewBox="0 0 80 80" className="w-full h-full">
        <defs>
            <linearGradient id="mobileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EC4899" />
                <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
        </defs>
        {/* Phone Body */}
        <rect x="22" y="8" width="36" height="64" rx="6" fill="url(#mobileGradient)" />
        {/* Screen */}
        <rect x="25" y="12" width="30" height="52" rx="3" fill="#1F2937" />
        {/* Screen Content */}
        <rect x="28" y="16" width="24" height="10" rx="2" fill="#374151" />
        <rect x="28" y="30" width="15" height="4" rx="1" fill="#374151" />
        <rect x="28" y="38" width="20" height="4" rx="1" fill="#374151" />
        {/* Home Button Area */}
        <rect x="35" y="66" width="10" height="3" rx="1.5" fill="#6B7280" />
    </svg>
);

export const LaptopIcon = () => (
    <svg viewBox="0 0 80 80" className="w-full h-full">
        <defs>
            <linearGradient id="laptopGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
        </defs>
        {/* Screen */}
        <rect x="10" y="12" width="60" height="38" rx="3" fill="url(#laptopGradient)" />
        {/* Screen Inner */}
        <rect x="13" y="15" width="54" height="32" rx="2" fill="#1F2937" />
        {/* Screen Content */}
        <rect x="16" y="18" width="25" height="12" rx="1" fill="#374151" />
        {/* Keyboard Base */}
        <path d="M5 50 L10 50 L10 52 L70 52 L70 50 L75 50 L75 58 C75 60 73 62 71 62 L9 62 C7 62 5 60 5 58 Z" fill="#6B7280" />
        {/* Keyboard */}
        <rect x="12" y="53" width="56" height="7" rx="1" fill="#4B5563" />
        {/* Trackpad */}
        <rect x="30" y="54" width="20" height="5" rx="1" fill="#374151" />
    </svg>
);

export const ApplianceIcon = () => (
    <svg viewBox="0 0 80 80" className="w-full h-full">
        <defs>
            <linearGradient id="applianceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
        </defs>
        {/* Microwave Body */}
        <rect x="8" y="18" width="64" height="44" rx="4" fill="url(#applianceGradient)" />
        {/* Window */}
        <rect x="12" y="22" width="40" height="32" rx="2" fill="#1F2937" />
        {/* Control Panel */}
        <rect x="55" y="24" width="14" height="28" rx="1" fill="#F3F4F6" />
        {/* Buttons */}
        <circle cx="62" cy="32" r="3" fill="#9CA3AF" />
        <circle cx="62" cy="42" r="3" fill="#9CA3AF" />
        <rect x="58" y="48" width="8" height="2" rx="1" fill="#9CA3AF" />
        {/* Door Handle */}
        <rect x="48" y="35" width="2" height="10" rx="1" fill="#9CA3AF" />
        {/* Inner Grid */}
        <line x1="16" y1="30" x2="48" y2="30" stroke="#374151" strokeWidth="1" />
        <line x1="16" y1="38" x2="48" y2="38" stroke="#374151" strokeWidth="1" />
        <line x1="16" y1="46" x2="48" y2="46" stroke="#374151" strokeWidth="1" />
    </svg>
);

export default CategoryCard;
