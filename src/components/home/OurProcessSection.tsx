'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ClipboardCheck, Phone, Wrench, Shield } from 'lucide-react';

interface ProcessStep {
    step: number;
    title: string;
    description: string;
    icon: React.ReactNode;
}

interface OurProcessSectionProps {
    className?: string;
}

const processSteps: ProcessStep[] = [
    {
        step: 1,
        title: 'Inspection & Quote',
        description: 'We inspect the appliance & share a repair quote for approval',
        icon: <ClipboardCheck className="w-6 h-6" />
    },
    {
        step: 2,
        title: 'Approval or Expert Review',
        description: 'Repair begins after your approval. If unsure, call our expert',
        icon: <Phone className="w-6 h-6" />
    },
    {
        step: 3,
        title: 'Repair & Spare Parts',
        description: 'If needed, we source spare parts at fixed rates for the repair',
        icon: <Wrench className="w-6 h-6" />
    },
    {
        step: 4,
        title: 'Warranty Activation',
        description: 'Your appliance comes under 180 days warranty after repair',
        icon: <Shield className="w-6 h-6" />
    }
];

export const OurProcessSection: React.FC<OurProcessSectionProps> = ({ className }) => {
    return (
        <section className={cn("py-16 bg-gray-50", className)}>
            <div className="container mx-auto px-4">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-12 text-center">
                    Our Process
                </h2>

                <div className="max-w-3xl mx-auto">
                    <div className="relative">
                        {/* Vertical Line */}
                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block" />

                        <div className="space-y-8">
                            {processSteps.map((step, index) => (
                                <div key={step.step} className="flex gap-6 items-start">
                                    {/* Step Number Circle */}
                                    <div className="relative z-10 flex-shrink-0">
                                        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                                            {step.step}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 pb-8">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="text-indigo-600">
                                                {step.icon}
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {step.title}
                                            </h3>
                                        </div>
                                        <p className="text-gray-600 leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default OurProcessSection;
