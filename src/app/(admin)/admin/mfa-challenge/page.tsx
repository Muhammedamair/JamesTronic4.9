'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function MfaChallengePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [countdown, setCountdown] = useState(30);

  const inputRefs = Array(6).fill(null).map(() => useRef<HTMLInputElement>(null));

  // Handle MFA input - move to next field when 1 digit is entered
  const handleMfaInput = (index: number, value: string) => {
    if (/^\d$/.test(value) || value === '') {
      const newMfaCode = mfaCode.split('');
      newMfaCode[index] = value;
      const updatedCode = newMfaCode.join('');
      setMfaCode(updatedCode);

      // Move to next input if digit was entered and not on the last input
      if (value && index < 5) {
        inputRefs[index + 1].current?.focus();
      }
    }
  };

  // Handle backspace to move to previous input
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyMfa = async () => {
    if (mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfaCode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Success',
          description: 'MFA verified successfully. Redirecting...',
        });

        // Redirect to admin dashboard or continue to requested page
        router.push('/app');
      } else {
        setError(data.message || 'Invalid MFA code. Please try again.');
        toast({
          title: 'Error',
          description: data.message || 'Invalid MFA code. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    // Resend MFA code functionality would go here
    setCountdown(30);
    toast({
      title: 'Code Resent',
      description: 'A new MFA code has been sent to your device.',
    });
  };

  // Countdown timer effect for resend
  useState(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Admin MFA Verification</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Enter 6-digit MFA code
              </label>
              <div className="flex justify-between">
                {Array(6)
                  .fill(0)
                  .map((_, index) => (
                    <Input
                      key={index}
                      ref={inputRefs[index]}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={mfaCode[index] || ''}
                      onChange={(e) => handleMfaInput(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-12 text-center text-xl"
                      disabled={loading}
                    />
                  ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 p-2 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleVerifyMfa}
              disabled={loading || mfaCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify MFA Code'}
            </Button>

            <div className="text-center mt-4">
              <p className="text-sm text-gray-500">
                Didn't receive a code?{' '}
                {countdown > 0 ? (
                  <span className="text-gray-400">Resend in {countdown}s</span>
                ) : (
                  <button
                    onClick={handleResendCode}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}