'use client';

import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface EngineStubProps {
    engineId: string;
    title?: string;
    description?: string;
}

/**
 * EngineStub Component
 * 
 * Renders a professional "Coming Soon" placeholder for engine pages
 * that are not yet implemented. This prevents blank screens and
 * provides a clear user experience.
 * 
 * Usage:
 * ```tsx
 * <EngineStub 
 *   engineId="finance" 
 *   title="Finance Engine" 
 *   description="Advanced financial reporting and analytics" 
 * />
 * ```
 */
export function EngineStub({ engineId, title, description }: EngineStubProps) {
    const router = useRouter();

    const displayTitle = title || engineId.charAt(0).toUpperCase() + engineId.slice(1).replace(/-/g, ' ');

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            <div className="text-center max-w-md">
                {/* Icon */}
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                    <Construction className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    {displayTitle}
                </h1>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                    {description || 'This engine is under development.'}
                </p>

                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-sm text-amber-700 dark:text-amber-300 mb-8">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Coming Soon
                </div>

                {/* Engine ID for debugging */}
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 font-mono">
                    Engine ID: {engineId}
                </p>

                {/* Back Button */}
                <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                </Button>
            </div>
        </div>
    );
}

export default EngineStub;
