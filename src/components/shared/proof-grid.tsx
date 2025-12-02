'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { Wrench, Clock, User, Package } from 'lucide-react';

export const ProofGrid = () => {
  const [metrics, setMetrics] = useState({
    jobsCompleted: 0,
    slaHitRate: 0,
    activeTechnicians: 0,
    liveJobs: 0
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading data from an API
    // In a real implementation, this would fetch from an API endpoint
    const loadMetrics = async () => {
      try {
        setLoading(true);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock data - in reality, this would come from an API
        setMetrics({
          jobsCompleted: 1247, // This would come from a real metrics API
          slaHitRate: 94, // This would come from a real metrics API
          activeTechnicians: 23, // This would come from a real metrics API
          liveJobs: 68 // This would come from a real metrics API
        });
      } catch (error) {
        console.error('Error loading metrics:', error);
        // Set default values on error
        setMetrics({
          jobsCompleted: 0,
          slaHitRate: 0,
          activeTechnicians: 0,
          liveJobs: 0
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadMetrics();
  }, []);

  const metricItems = [
    { 
      title: "Jobs Completed", 
      value: loading ? '...' : metrics.jobsCompleted, 
      icon: <Wrench className="w-5 h-5" />,
      description: "Successful repairs"
    },
    { 
      title: "SLA Hit Rate", 
      value: loading ? '...' : `${metrics.slaHitRate}%`, 
      icon: <Clock className="w-5 h-5" />,
      description: "On-time completion"
    },
    { 
      title: "Active Technicians", 
      value: loading ? '...' : metrics.activeTechnicians, 
      icon: <User className="w-5 h-5" />,
      description: "Verified professionals"
    },
    { 
      title: "Live Jobs", 
      value: loading ? '...' : metrics.liveJobs, 
      icon: <Package className="w-5 h-5" />,
      description: "In-progress repairs"
    }
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-center">Service Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricItems.map((item, index) => (
            <div key={index} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex justify-center mb-2 text-blue-600">
                {item.icon}
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {item.value}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {item.title}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};