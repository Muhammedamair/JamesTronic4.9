'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, TrendingUp, Clock } from 'lucide-react';

interface RiskHeatmapProps {
  ticketsAtRisk?: Array<{
    id: string;
    customerName: string;
    device: string;
    eta: string;
    riskLevel: number;
    riskScore: number;
    status: string;
  }>;
  className?: string;
}

const RiskHeatmap: React.FC<RiskHeatmapProps> = ({
  ticketsAtRisk = [],
  className = ''
}) => {
  const getRiskLevelInfo = (level: number) => {
    switch (level) {
      case 3:
        return { label: 'High Risk', color: 'bg-red-500', icon: AlertTriangle, text: 'text-red-600' };
      case 2:
        return { label: 'Medium Risk', color: 'bg-orange-500', icon: AlertTriangle, text: 'text-orange-600' };
      case 1:
        return { label: 'Low Risk', color: 'bg-yellow-500', icon: AlertTriangle, text: 'text-yellow-600' };
      default:
        return { label: 'Low Risk', color: 'bg-green-500', icon: CheckCircle, text: 'text-green-600' };
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Risk Heatmap</CardTitle>
          <Badge variant="outline">{ticketsAtRisk.length} tickets at risk</Badge>
        </div>
        <CardDescription>Currently at-risk tickets requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        {ticketsAtRisk.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-500">No tickets currently at risk</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ticketsAtRisk.map((ticket) => {
              const riskInfo = getRiskLevelInfo(ticket.riskLevel);
              return (
                <div 
                  key={ticket.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${riskInfo.color} bg-opacity-20`}>
                      <riskInfo.icon className={`h-4 w-4 ${riskInfo.text}`} />
                    </div>
                    <div>
                      <div className="font-medium">#{ticket.id.substring(0, 8)}</div>
                      <div className="text-sm text-gray-500">{ticket.customerName} - {ticket.device}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{ticket.status}</div>
                    <div className="text-sm text-gray-500 flex items-center justify-end">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(ticket.eta).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { RiskHeatmap };