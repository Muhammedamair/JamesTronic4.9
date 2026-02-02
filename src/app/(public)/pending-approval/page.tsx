'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Registration Pending</CardTitle>
          <CardDescription>
            Your registration is under review
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Approval Required</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Your registration has been submitted and is pending admin approval. 
              You will be notified once your account is activated.
            </p>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Thank you for joining JamesTronic!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}