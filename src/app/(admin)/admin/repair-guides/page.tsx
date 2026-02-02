'use client';

import { useState, useEffect } from 'react';
import { repairGuideApi } from '@/lib/api/repair-guide';
import { RepairGuide } from '@/lib/types/repair-guide';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RepairGuidesLibrary() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [guides, setGuides] = useState<RepairGuide[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadGuides();
    }, []);

    const loadGuides = async () => {
        setLoading(true);
        try {
            const data = await repairGuideApi.getAllGuides();
            setGuides(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!query) {
            loadGuides();
            return;
        }
        setLoading(true);
        try {
            const data = await repairGuideApi.searchGuides(query);
            setGuides(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Repair Knowledge Base</h1>
                    <p className="text-muted-foreground">AI-Assisted Technical Manuals</p>
                </div>
            </div>

            <div className="flex gap-2 max-w-md">
                <Input
                    placeholder="Search device model (e.g. iPhone 13)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <Button onClick={handleSearch} variant="outline">
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {guides.map(guide => (
                    <Card
                        key={guide.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => router.push(`/admin/repair-guides/${guide.id}`)}
                    >
                        <CardHeader className="flex flex-row items-start justify-between pb-2">
                            <div>
                                <Badge variant="outline" className="mb-2">{guide.device_model}</Badge>
                                <CardTitle className="text-lg">{guide.title}</CardTitle>
                            </div>
                            <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between text-sm text-muted-foreground mt-4">
                                <span className="flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {guide.difficulty}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {guide.estim_time_mins} mins
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
