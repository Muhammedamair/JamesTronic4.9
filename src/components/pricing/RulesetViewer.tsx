'use client';

import React from 'react';
import { Card } from '@/components/ui/card';

interface RulesetViewerProps {
    rules: any;
    className?: string;
}

export const RulesetViewer: React.FC<RulesetViewerProps> = ({ rules, className }) => {
    return (
        <Card className={`bg-slate-950 border-slate-800 p-4 font-mono text-xs overflow-auto max-h-[60vh] ${className}`}>
            <pre className="text-slate-300">
                {JSON.stringify(rules, null, 2)}
            </pre>
        </Card>
    );
};
