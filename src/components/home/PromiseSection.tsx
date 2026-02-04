'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Calendar, Banknote } from 'lucide-react';

interface PromiseItem {
    icon: React.ReactNode;
    title: string;
    description?: string;
}

interface PromiseSectionProps {
    className?: string;
}

const promiseItems: PromiseItem[] = [
    {
        icon: <ShieldCheck className="w-6 h-6" />,
        title: 'Verified Professionals',
        description: 'Background verified and trained technicians'
    },
    {
        icon: <Calendar className="w-6 h-6" />,
        title: 'Hassle Free Booking',
        description: 'Book in 3 clicks, track in real-time'
    },
    {
        icon: <Banknote className="w-6 h-6" />,
        title: 'Transparent Pricing',
        description: 'No hidden charges, upfront quotes'
    }
];

export const PromiseSection: React.FC<PromiseSectionProps> = ({ className }) => {
    return (
        <section className={cn("py-8 bg-white border-y border-gray-100", className)}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-center mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-lg font-semibold text-gray-900">JamesTronic Promise</span>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                    {promiseItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                            <div className="text-green-600">
                                {item.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-green-600">✓</span>
                                    <span className="font-medium text-gray-900">{item.title}</span>
                                </div>
                                {item.description && (
                                    <p className="text-sm text-gray-500 ml-5">{item.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// Compact version for sidebars
export const PromiseBadge: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <div className={cn("p-4 bg-gray-50 rounded-xl border border-gray-100", className)}>
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                </div>
                <span className="font-semibold text-gray-900">JamesTronic Promise</span>
            </div>
            <div className="space-y-2">
                {promiseItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="text-green-600">✓</span>
                        <span className="text-gray-700">{item.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PromiseSection;
