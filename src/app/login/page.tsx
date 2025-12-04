'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function OTPLoginPage() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendAvailable, setResendAvailable] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRefs = Array(6).fill(null).map(() => useRef<HTMLInputElement>(null));

  const normalizePhone = (phone: string): string => {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return `+${digitsOnly}`;
    } else if (digitsOnly.length === 13 && digitsOnly.startsWith('+91')) {
      return digitsOnly;
    } else {
      return phone;
    }
  };

  const handleSendOTP = async () => {
    // Validate phone number format
    const normalizedPhone = normalizePhone(phone);
    const phoneRegex = /^\+91[6-9]\d{9}$/;

    if (!phoneRegex.test(normalizedPhone)) {
      setError('INVALID_PHONE_FORMAT');
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid Indian phone number (10 digits starting with 6-9)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_e164: normalizedPhone,
          channel: 'whatsapp',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentStep('otp');
        toast({
          title: 'Success',
          description: 'OTP sent to your WhatsApp',
        });
        setResendAvailable(false);
        // Set a timer to make resend available after 30 seconds
        setTimeout(() => setResendAvailable(true), 30000);
      } else {
        if (data.error) {
          switch (data.error) {
            case 'Too many OTP requests. Please try again later.':
              setError('RATE_LIMITED');
              toast({
                title: 'Rate Limited',
                description: 'Too many OTP requests. Please try again later.',
                variant: 'destructive',
              });
              break;
            case 'Invalid phone number format. Use Indian number starting with +91.':
              setError('INVALID_PHONE_FORMAT');
              toast({
                title: 'Invalid Phone Number',
                description: 'Please enter a valid Indian phone number (10 digits starting with 6-9)',
                variant: 'destructive',
              });
              break;
            default:
              setError('UNKNOWN_ERROR');
              toast({
                title: 'Error',
                description: 'Something went wrong, please try again.',
                variant: 'destructive',
              });
              break;
          }
        }
      }
    } catch (err) {
      setError('UNKNOWN_ERROR');
      toast({
        title: 'Error',
        description: 'Something went wrong, please try again.',
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter a 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setError('');

    // Generate a simple device fingerprint (could be more sophisticated)
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : 'web-generic';
    const deviceFingerprint = `web-${btoa(userAgent.substring(0, 20)).substring(0, 10)}`;

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_e164: normalizePhone(phone),
          otp,
          device_fingerprint: deviceFingerprint,
          role_hint: 'customer',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Redirect to the requested page after successful OTP verification
        router.push(redirectUrl);
      } else {
        if (data.code) {
          switch (data.code) {
            case 'OTP_INVALID':
              setError('OTP_INVALID');
              toast({
                title: 'Invalid OTP',
                description: 'Invalid OTP. Please try again.',
                variant: 'destructive',
              });
              break;
            case 'OTP_NOT_FOUND_OR_EXPIRED':
              setError('OTP_NOT_FOUND_OR_EXPIRED');
              toast({
                title: 'OTP Expired',
                description: 'OTP has expired or is invalid. Please request a new one.',
                variant: 'destructive',
              });
              break;
            case 'OTP_TOO_MANY_ATTEMPTS':
              setError('OTP_TOO_MANY_ATTEMPTS');
              toast({
                title: 'Too Many Attempts',
                description: 'Too many attempts. Please request a new OTP.',
                variant: 'destructive',
              });
              break;
            case 'RATE_LIMITED':
              setError('RATE_LIMITED');
              toast({
                title: 'Rate Limited',
                description: 'Too many attempts. Please try again later.',
                variant: 'destructive',
              });
              break;
            default:
              setError('UNKNOWN_ERROR');
              toast({
                title: 'Error',
                description: 'Something went wrong, please try again.',
                variant: 'destructive',
              });
              break;
          }
        } else {
          setError('UNKNOWN_ERROR');
          toast({
            title: 'Error',
            description: 'Something went wrong, please try again.',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      setError('UNKNOWN_ERROR');
      toast({
        title: 'Error',
        description: 'Something went wrong, please try again.',
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!phone) {
      toast({
        title: 'Error',
        description: 'Please enter your phone number first',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_e164: normalizePhone(phone),
          channel: 'whatsapp',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentStep('otp');
        toast({
          title: 'Success',
          description: 'OTP sent to your WhatsApp',
        });
        setResendAvailable(false);
        // Set a timer to make resend available after 30 seconds
        setTimeout(() => setResendAvailable(true), 30000);
      } else {
        if (data.error) {
          switch (data.error) {
            case 'Too many OTP requests. Please try again later.':
              setError('RATE_LIMITED');
              toast({
                title: 'Rate Limited',
                description: 'Too many OTP requests. Please try again later.',
                variant: 'destructive',
              });
              break;
            case 'Invalid phone number format. Use Indian number starting with +91.':
              setError('INVALID_PHONE_FORMAT');
              toast({
                title: 'Invalid Phone Number',
                description: 'Please enter a valid Indian phone number (10 digits starting with 6-9)',
                variant: 'destructive',
              });
              break;
            default:
              setError('UNKNOWN_ERROR');
              toast({
                title: 'Error',
                description: 'Something went wrong, please try again.',
                variant: 'destructive',
              });
              break;
          }
        }
      }
    } catch (err) {
      setError('UNKNOWN_ERROR');
      toast({
        title: 'Error',
        description: 'Something went wrong, please try again.',
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input - move to next field when 1 digit is entered
  const handleOTPInput = (index: number, value: string) => {
    if (/^\d$/.test(value) || value === '') {
      const newOtp = otp.split('');
      newOtp[index] = value;
      setOtp(newOtp.join(''));

      // Move to next input if digit was entered and not on the last input
      if (value && index < 5) {
        otpInputRefs[index + 1].current?.focus();
      }
    }
  };

  // Handle backspace to move to previous input
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">JamesTronic Login</CardTitle>
          <CardDescription className="text-center">
            Sign in with your WhatsApp number
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 'phone' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-sm text-gray-500">+91</span>
                    <Input
                      ref={phoneInputRef}
                      id="phone"
                      type="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-8"
                      disabled={loading}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  We'll send a one-time password to your WhatsApp
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 p-2 bg-red-50 rounded-md">
                  {error === 'INVALID_PHONE_FORMAT' && 'Please enter a valid 10-digit Indian phone number starting with 6-9'}
                  {error === 'RATE_LIMITED' && 'Too many OTP requests. Please try again later.'}
                  {error === 'UNKNOWN_ERROR' && 'Something went wrong, please try again.'}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSendOTP}
                disabled={loading || !phone}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Enter 6-digit OTP
                </label>
                <div className="flex justify-between">
                  {Array(6)
                    .fill(0)
                    .map((_, index) => (
                      <Input
                        key={index}
                        ref={otpInputRefs[index]}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[index] || ''}
                        onChange={(e) => handleOTPInput(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-xl"
                        disabled={loading}
                      />
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter the OTP sent to your WhatsApp
                </p>

                {resendAvailable ? (
                  <div className="text-center mt-2">
                    <button
                      onClick={handleResendOTP}
                      disabled={loading}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  </div>
                ) : (
                  <div className="text-center mt-2">
                    <p className="text-sm text-gray-500">Resend OTP in <span className="font-medium">30</span>s</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 p-2 bg-red-50 rounded-md">
                  {error === 'OTP_INVALID' && 'Invalid OTP. Please try again.'}
                  {error === 'OTP_NOT_FOUND_OR_EXPIRED' && 'OTP has expired or is invalid. Please request a new one.'}
                  {error === 'OTP_TOO_MANY_ATTEMPTS' && 'Too many attempts. Please request a new OTP.'}
                  {error === 'RATE_LIMITED' && 'Too many attempts. Please try again later.'}
                  {error === 'UNKNOWN_ERROR' && 'Something went wrong, please try again.'}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </Button>

              <div className="text-center mt-4">
                <button
                  onClick={() => setCurrentStep('phone')}
                  disabled={loading}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium disabled:opacity-50"
                >
                  Use different number
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}