'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useToast } from '@/components/ui/use-toast';

export function useExpansionData() {
    const { supabase, user } = useSupabase();
    const { toast } = useToast();
    const [cityId, setCityId] = useState<string | null>(null);
    const [cityName, setCityName] = useState<string>('Loading...');

    // 1. Resolve Manager's City Scope
    useEffect(() => {
        async function fetchCityScope() {
            if (!user) return;

            // Check app_metadata for city_id (set by seed script/admin)
            const appMetadata = user.app_metadata || {};
            const metadataCityId = appMetadata.city_id;

            if (metadataCityId) {
                setCityId(metadataCityId);

                // Fetch city name directly from cities table
                const { data: city, error } = await supabase
                    .from('cities')
                    .select('name')
                    .eq('id', metadataCityId)
                    .single();

                if (!error && city) {
                    setCityName(city.name);
                } else {
                    setCityName('Unknown City');
                }
            } else {
                // For Admins or users without city scope
                setCityName('Global Overview');
            }
        }
        fetchCityScope();
    }, [user, supabase]);

    // 2. Fetch Latest Runs
    async function getLatestRuns(limit = 10) {
        let query = supabase
            .from('expansion_scenario_runs')
            .select('*, expansion_scenarios(name)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (cityId) {
            query = query.eq('city_id', cityId);
        }

        const { data, error } = await query;
        if (error) {
            toast({ title: 'Error fetching runs', description: error.message, variant: 'destructive' });
            return [];
        }
        return data;
    }

    // 3. Fetch Scenarios
    async function getScenarios() {
        let query = supabase
            .from('expansion_scenarios')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (cityId) {
            query = query.eq('city_id', cityId);
        }

        const { data, error } = await query;
        if (error) {
            return [];
        }
        return data;
    }

    return {
        cityId,
        cityName,
        getLatestRuns,
        getScenarios
    };
}
