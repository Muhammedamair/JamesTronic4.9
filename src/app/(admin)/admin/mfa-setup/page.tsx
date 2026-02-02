'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { QrCode, Shield, Key, CheckCircle } from 'lucide-react';

interface MfaStatus {
  enabled: boolean;
  last_verified_at?: string;
  trusted_devices_count: number;
}

export default function AdminMfaSetupPage() {
  const { toast } = useToast();
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'completed'>('status');
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const response = await fetch('/api/admin/mfa/status');

      if (!response.ok) {
        throw new Error('Failed to fetch MFA status');
      }

      const data = await response.json();
      setMfaStatus(data.status);
    } catch (error) {
      console.error('Error fetching MFA status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch MFA status',
        variant: 'destructive',
      });
    }
  };

  const startMfaSetup = async () => {
    try {
      const response = await fetch('/api/admin/mfa/setup/start', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start MFA setup');
      }

      const data = await response.json();
      setQrCodeUrl(data.qr_url);
      setSecret(data.secret);
      setStep('setup');
    } catch (error) {
      console.error('Error starting MFA setup:', error);
      toast({
        title: 'Error',
        description: 'Failed to start MFA setup',
        variant: 'destructive',
      });
    }
  };

  const verifyMfaCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Error',
        description: 'Please enter a valid 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/mfa/setup/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: verificationCode,
          secret: secret,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setBackupCodes(data.backup_codes || []);
        setStep('completed');

        toast({
          title: 'Success',
          description: 'MFA setup completed successfully',
          variant: 'default',
        });
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Error verifying MFA code:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Verification failed',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          Admin MFA Setup
        </h1>
        <p className="text-muted-foreground mt-2">
          Secure your admin account with two-factor authentication
        </p>
      </div>

      {step === 'status' && mfaStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              MFA Status
            </CardTitle>
            <CardDescription>
              Current MFA configuration for your admin account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <h3 className="font-medium">MFA Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {mfaStatus.enabled ? 'Enabled' : 'Not Enabled'}
                  </p>
                </div>
                <Badge variant={mfaStatus.enabled ? 'default' : 'destructive'}>
                  {mfaStatus.enabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <h3 className="font-medium">Last Verified</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(mfaStatus.last_verified_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <h3 className="font-medium">Trusted Devices</h3>
                  <p className="text-sm text-muted-foreground">
                    {mfaStatus.trusted_devices_count} devices
                  </p>
                </div>
              </div>

              <div className="pt-4">
                {!mfaStatus.enabled ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={startMfaSetup}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Setup MFA
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        // Implementation for disabling MFA would go here
                      }}
                    >
                      Disable MFA
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={startMfaSetup}
                    >
                      Reconfigure MFA
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'setup' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Setup Authenticator App
            </CardTitle>
            <CardDescription>
              Follow these steps to enable two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-block p-4 bg-white rounded-lg">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="MFA QR Code"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                      <QrCode className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Scan this QR code with your authenticator app
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Manual Entry Key</Label>
                  <div className="mt-1 p-3 bg-muted rounded font-mono text-sm break-all">
                    {secret || 'Loading...'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter this key manually if you cannot scan the QR code
                  </p>
                </div>

                <div>
                  <Label htmlFor="verification-code">Enter 6-digit Code</Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      id="verification-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="font-mono text-center text-xl tracking-widest"
                    />
                    <Button
                      type="button"
                      onClick={verifyMfaCode}
                      disabled={verificationCode.length !== 6}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Recommended authenticator apps:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Google Authenticator (iOS / Android)</li>
                  <li>Microsoft Authenticator (iOS / Android)</li>
                  <li>Authy (iOS / Android / Desktop)</li>
                  <li>1Password (iOS / Android / Desktop)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'completed' && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>MFA Setup Complete!</CardTitle>
            <CardDescription>
              Your admin account is now secured with two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <h3 className="font-medium mb-2">Backup Codes</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Save these backup codes in a secure location. You can use these if you lose access to your authenticator app.
              </p>

              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="p-2 bg-muted rounded font-mono text-sm"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={() => {
                setStep('status');
                fetchMfaStatus(); // Refresh status
              }}
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}