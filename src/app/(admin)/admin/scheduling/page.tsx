'use client';

import { useState, useEffect } from 'react';
import { schedulingApi } from '@/lib/api/scheduling';
import { TechCandidate, JobAssignment } from '@/lib/types/scheduling';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    MapPin, Calendar, Clock, UserCheck, Navigation, CheckCircle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function SchedulingDashboard() {
    const { toast } = useToast();

    // State for "Dispatch Simulation"
    // In a real app, we'd select a ticket from a list. Here we simulate "Ticket #101" at a fixed location.
    const [candidates, setCandidates] = useState<TechCandidate[]>([]);
    const [loading, setLoading] = useState(false);
    const [assignment, setAssignment] = useState<JobAssignment | null>(null);

    // Dummy Ticket Location (e.g. Indiranagar, Bangalore)
    const TICKET_LOC = { lat: 12.9716, lng: 77.6412 };
    const TICKET_ID = '00000000-0000-4000-8000-000000000001'; // Reusing our valid simulation ID

    const findTechnicians = async () => {
        setLoading(true);
        try {
            const data = await schedulingApi.getTechCandidates(TICKET_LOC.lat, TICKET_LOC.lng);
            setCandidates(data);
            if (data.length === 0) {
                toast({ title: 'No Technicians Found', description: 'Ensure you have users with role="technician".' });
            }
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'Failed to find technicians.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (candidate: TechCandidate) => {
        try {
            const result = await schedulingApi.assignJob(
                TICKET_ID,
                candidate.technician_id,
                candidate.match_score
            );
            setAssignment(result);
            toast({
                title: 'Dispatch Successful',
                description: `Job assigned to ${candidate.full_name || 'Technician'}.`,
            });
        } catch (err) {
            console.error(err);
            toast({ title: 'Assignment Failed', description: 'Could not create assignment.', variant: 'destructive' });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dispatch Center</h1>
                    <p className="text-muted-foreground">AI Scheduling & Resource Allocation</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Active Ticket Card */}
                <Card className="md:col-span-1 border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Navigation className="h-5 w-5 text-blue-600" />
                            Pending Job #101
                        </CardTitle>
                        <CardDescription>Simulated Ticket</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm">
                            <div className="font-semibold text-slate-700">Location</div>
                            <div className="text-slate-500">Indiranagar, Bangalore (12.97, 77.64)</div>
                        </div>
                        <div className="text-sm">
                            <div className="font-semibold text-slate-700">Issue</div>
                            <div className="text-slate-500">AC Repair - High Priority</div>
                        </div>

                        {assignment ? (
                            <div className="p-4 bg-green-100 border border-green-200 rounded-lg text-green-800 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5" />
                                <div>
                                    <div className="font-bold">Assigned!</div>
                                    <div className="text-xs">Ref: {assignment.id.slice(0, 8)}</div>
                                </div>
                            </div>
                        ) : (
                            <Button onClick={findTechnicians} disabled={loading} className="w-full">
                                {loading ? 'Scanning...' : 'Find Best Technician'}
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Candidates List */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Recommended Technicians</CardTitle>
                        <CardDescription>Ranked by Distance & Availability Score</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {candidates.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                Click "Find Best Technician" to run the AI engine.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {candidates.map((tech, idx) => (
                                    <div key={tech.technician_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-amber-500' : 'bg-slate-400'}`}>
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-bold">{tech.full_name || 'Unknown Tech'}</div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {tech.distance_km} km away</span>
                                                    <span className="flex items-center"><UserCheck className="w-3 h-3 mr-1" /> Match: {tech.match_score}%</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button size="sm" variant={idx === 0 ? 'default' : 'outline'} onClick={() => handleAssign(tech)} disabled={!!assignment}>
                                            Assign
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
