'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { repairGuideApi } from '@/lib/api/repair-guide';
import { RepairGuide, RepairStep } from '@/lib/types/repair-guide';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ChevronRight, ChevronLeft, Bot, AlertTriangle, CheckCircle } from 'lucide-react';

export default function GuideDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [guide, setGuide] = useState<RepairGuide | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');

    useEffect(() => {
        if (params.id) {
            repairGuideApi.getGuideDetails(params.id as string).then(setGuide).catch(console.error);
        }
    }, [params.id]);

    if (!guide || !guide.steps) return <div className="p-6">Loading guide...</div>;

    const currentStep = guide.steps[currentStepIndex];
    const progress = ((currentStepIndex + 1) / guide.steps.length) * 100;

    const handleNext = () => {
        if (currentStepIndex < (guide.steps?.length || 0) - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            // Finish
            router.push('/admin/repair-guides');
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const handleAiAsk = async () => {
        if (!aiQuery) return;
        const response = await repairGuideApi.simulateDiagnosis(aiQuery);
        setAiResponse(response);
    };

    return (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-4rem)]">

            {/* Left: Steps Area */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">{guide.device_model}: {guide.title}</h1>
                        <p className="text-muted-foreground">Step {currentStepIndex + 1} of {guide.steps.length}</p>
                    </div>
                    <Badge>{guide.difficulty}</Badge>
                </div>

                <Progress value={progress} className="h-2" />

                <Card className="min-h-[400px] flex flex-col justify-between">
                    <CardHeader>
                        <CardTitle className="text-4xl text-slate-200">
                            {currentStep.order_index}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-6">
                        <p className="text-2xl font-medium leading-relaxed">
                            {currentStep.instruction}
                        </p>

                        {currentStep.caution_type !== 'none' && (
                            <Alert variant={currentStep.caution_type === 'critical' ? 'destructive' : 'default'} className="border-l-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle className="uppercase font-bold">{currentStep.caution_type} ALERT</AlertTitle>
                                <AlertDescription>
                                    Pay close attention to this step to avoid component damage.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>

                    <div className="p-6 border-t bg-muted/20 flex justify-between">
                        <Button variant="outline" onClick={handlePrev} disabled={currentStepIndex === 0}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                        </Button>
                        <Button onClick={handleNext}>
                            {currentStepIndex === guide.steps.length - 1 ? 'Finish Repair' : 'Next Step'}
                            {currentStepIndex !== guide.steps.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Right: AI Copilot */}
            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-purple-500" />
                            Technician Copilot
                        </CardTitle>
                        <CardDescription>
                            Ask for diagnostic help or component ID.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-4">
                        <ScrollArea className="flex-1 bg-muted/30 rounded-md p-4 h-[300px]">
                            {aiResponse ? (
                                <div className="flex gap-3 items-start">
                                    <Bot className="h-8 w-8 text-purple-600 bg-purple-100 rounded-full p-1" />
                                    <div className="bg-white p-3 rounded-lg text-sm shadow-sm border">
                                        {aiResponse}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-sm text-muted-foreground mt-10">
                                    AI is ready. Try searching for symptoms like "water damage" or "screen crack".
                                </p>
                            )}
                        </ScrollArea>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Describe symptom..."
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAiAsk()}
                            />
                            <Button size="icon" onClick={handleAiAsk}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
