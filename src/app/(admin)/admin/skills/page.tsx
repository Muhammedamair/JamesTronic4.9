'use client';

import { useState, useEffect } from 'react';
import { skillsApi } from '@/lib/api/skills';
import { TechnicianSkillProfile, XPAwardResult } from '@/lib/types/skills';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from "@/components/ui/progress"
import {
    Trophy, Star, Zap, Activity, Award, Shield, BookOpen, Wrench
} from 'lucide-react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useToast } from '@/components/ui/use-toast';

export default function SkillsDashboard() {
    const { toast } = useToast();
    const { user } = useSupabase();
    const [profile, setProfile] = useState<TechnicianSkillProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [simulating, setSimulating] = useState(false);
    const [availableSkills, setAvailableSkills] = useState<any[]>([]);

    const fetchData = async () => {
        if (!user) return;
        try {
            const data = await skillsApi.getSkillTree(user.id);
            setProfile(data);

            const skills = await skillsApi.getAllSkills();
            setAvailableSkills(skills);
        } catch (err) {
            console.error('Error fetching skills data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleSimulateRepair = async () => {
        if (!user || !profile) return;
        setSimulating(true);
        try {
            // Find a random skill to boost
            const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
            const xpGain = 150 + Math.floor(Math.random() * 100);

            const result: XPAwardResult = await skillsApi.awardXP(
                user.id,
                xpGain,
                'Simulated Repair Completion',
                skill?.id
            );

            let msg = `+${xpGain} XP earned!`;
            if (result.leveled_up) {
                msg += ` LEVEL UP! You are now Level ${result.new_level}!`;
                toast({
                    title: 'LEVEL UP! 🎉',
                    description: msg,
                });
            } else {
                toast({ title: 'XP Gained', description: msg });
            }

            fetchData();
        } catch (err) {
            console.error(err);
            toast({ title: 'Simulation Error', description: 'Failed to award XP.', variant: 'destructive' });
        } finally {
            setSimulating(false);
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'bronze': return 'bg-amber-700';
            case 'silver': return 'bg-slate-400';
            case 'gold': return 'bg-yellow-500';
            case 'platinum': return 'bg-cyan-400';
            case 'diamond': return 'bg-blue-600';
            default: return 'bg-gray-500';
        }
    };

    if (!user) {
        return <div className="p-8 text-center">Please log in to view your skill profile.</div>;
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Skill Evolution</h1>
                    <p className="text-muted-foreground">Technician career growth & gamification</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSimulateRepair} disabled={simulating || loading}>
                        <Wrench className="w-4 h-4 mr-2" />
                        {simulating ? 'Working...' : 'Simulate Repair (+XP)'}
                    </Button>
                    <Button variant="outline" onClick={fetchData}>
                        Refresh
                    </Button>
                </div>
            </div>

            {loading ? (
                <div>Loading profile...</div>
            ) : profile ? (
                <>
                    {/* Player Card Banner */}
                    <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
                        <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center border-4 border-yellow-500">
                                    <div className="text-4xl font-bold">{profile.global_level}</div>
                                </div>
                                <Badge className="absolute -bottom-2 w-full justify-center bg-yellow-500 text-black">LEVEL</Badge>
                            </div>

                            <div className="flex-1 space-y-2 w-full">
                                <div className="flex justify-between items-end">
                                    <h2 className="text-2xl font-bold">Technician {user.email?.split('@')[0]}</h2>
                                    <span className="text-sm text-slate-300">{profile.total_xp % 1000} / 1000 XP to next level</span>
                                </div>
                                <Progress value={(profile.total_xp % 1000) / 10} className="h-4 bg-slate-700" />
                                <div className="flex gap-4 pt-2">
                                    <div className="flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-yellow-500" />
                                        <span className="text-sm font-medium">{profile.achievements.length} Badges</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium">{profile.skills.length} Skills Unlocks</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Skills List */}
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Skill Matrix</CardTitle>
                                <CardDescription>Your technical capabilities</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {profile.skills.length === 0 ? (
                                    <div className="text-center p-4 text-muted-foreground w-full col-span-2">
                                        No skills started yet. complete jobs to earn XP!
                                    </div>
                                ) : (
                                    profile.skills.map(skill => (
                                        <div key={skill.skill_id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Zap className="h-5 w-5 text-slate-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-semibold text-sm">{skill.name}</span>
                                                    <span className="text-xs text-muted-foreground">Lvl {skill.user_level}</span>
                                                </div>
                                                <Progress value={Math.min(100, (skill.user_xp % 100))} className="h-1.5" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Achievements */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Trophy Case</CardTitle>
                                <CardDescription>Unlocked achievements</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {profile.achievements.length === 0 ? (
                                    <div className="text-center p-4 text-muted-foreground">
                                        No badges yet. Keep working!
                                    </div>
                                ) : (
                                    profile.achievements.map(ach => (
                                        <div key={ach.achievement_id} className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center text-white ${getTierColor(ach.tier)}`}>
                                                <Award className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{ach.name}</div>
                                                <div className="text-[10px] uppercase text-muted-foreground">{ach.tier}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : (
                <div>No profile found.</div>
            )}
        </div>
    );
}
