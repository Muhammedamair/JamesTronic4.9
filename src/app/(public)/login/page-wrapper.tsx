'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { getDashboardRouteForRole } from '@/lib/auth/roleDashboardMapper';
import { createClient } from '@/utils/supabase/client';

// Helper function to sanitize redirect URLs
function sanitizeRedirect(input: string): string {
  // If no redirect provided, default to home
  if (!input) {
    return '/';
  }

  // Convert to lowercase for case-insensitive checks
  const lowerInput = input.toLowerCase();

  // Check if it contains external indicators (http, https, //) - including encoded versions
  if (
    input.startsWith('http://') ||
    input.startsWith('https://') ||
    input.startsWith('//') ||
    input.includes('://') ||
    // Check for encoded forms
    lowerInput.includes('%2f%2f') || // // encoded
    lowerInput.includes('%3a%2f%2f') || // :// encoded
    lowerInput.includes('%5c') // \ encoded
  ) {
    // If it's an external URL, return home as fallback
    return '/';
  }

  // Additional check for backslash usage
  if (input.includes('\\')) {
    return '/';
  }

  // Only allow paths that start with '/'
  if (!input.startsWith('/')) {
    return '/';
  }

  // Additional sanitization: prevent directory traversal attempts
  if (input.includes('../') || input.includes('..\\')) {
    return '/';
  }

  // Return the sanitized path
  return input;
}

export default function OTPLoginPageWrapper() {
  const { toast } = useToast();
  const supabase = createClient();
  const [currentStep, setCurrentStep] = useState<'contact' | 'otp'>('contact');
  const [contact, setContact] = useState('');
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendAvailable, setResendAvailable] = useState(true); // Start with true to allow initial send
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0); // For countdown display

  // State machine for auth flow
  const [authState, setAuthState] = useState<'IDLE' | 'SENDING' | 'OTP_SENT' | 'VERIFYING' | 'AUTHED'>('IDLE');

  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirect') || searchParams.get('next') || '/';

  // Sanitize the requested redirect
  const sanitizedRedirect = sanitizeRedirect(requestedRedirect);

  const contactInputRef = useRef<HTMLInputElement>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Create computed flags for button enable logic
  const contactNormalized = contact.trim();
  const isEmailValid = contactType === 'email' ? validateEmail(contactNormalized) : false;
  const isPhoneValid = contactType === 'phone' ? /^\+91[6-9]\d{9}$/.test(normalizePhone(contactNormalized)) : false;
  const contactValid = contactType === 'email' ? isEmailValid : isPhoneValid;
  const canSendOtp = !loading && resendAvailable && contactValid && authState !== 'VERIFYING';

  // Timer effect for resend availability
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!resendAvailable && resendSecondsLeft > 0) {
      timer = setTimeout(() => {
        setResendSecondsLeft(prev => {
          if (prev <= 1) {
            setResendAvailable(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (!resendAvailable && resendSecondsLeft === 0) {
      // Initialize the countdown when resend becomes unavailable
      setResendSecondsLeft(30);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendAvailable, resendSecondsLeft]);

  const handleSendOTP = async () => {
    // Single-flight: if already sending or in cooldown, return
    if (authState === 'SENDING' || !resendAvailable) {
      return;
    }

    // Validate contact before setting loading state
    if (!contactValid) {
      setError(contactType === 'email' ? 'INVALID_EMAIL_FORMAT' : 'INVALID_PHONE_FORMAT');
      toast({
        title: contactType === 'email' ? 'Invalid Email' : 'Invalid Phone Number',
        description: contactType === 'email'
          ? 'Please enter a valid email address'
          : 'Please enter a valid Indian phone number (10 digits starting with 6-9)',
        variant: 'destructive',
      });
      setAuthState('IDLE');
      return;
    }

    console.log('[OTP] send start'); // Dev-only console marker
    setAuthState('SENDING');
    setLoading(true);
    setError('');

    try {
      let response;
      if (contactType === 'phone') {
        // Validate phone number format
        const normalizedPhone = normalizePhone(contact);
        const phoneRegex = /^\+91[6-9]\d{9}$/;

        if (!phoneRegex.test(normalizedPhone)) {
          setError('INVALID_PHONE_FORMAT');
          toast({
            title: 'Invalid Phone Number',
            description: 'Please enter a valid Indian phone number (10 digits starting with 6-9)',
            variant: 'destructive',
          });
          setAuthState('IDLE');
          setLoading(false);
          return;
        }

        response = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_e164: normalizedPhone,
            channel: 'sms',
          }),
        });
      } else {
        // Validate email format
        if (!validateEmail(contact)) {
          setError('INVALID_EMAIL_FORMAT');
          toast({
            title: 'Invalid Email',
            description: 'Please enter a valid email address',
            variant: 'destructive',
          });
          setAuthState('IDLE');
          setLoading(false);
          return;
        }

        response = await fetch('/api/auth/request-email-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: contact,
          }),
        });
      }

      const data = await response.json();

      if (response.ok) {
        setCurrentStep('otp');
        setAuthState('OTP_SENT');
        toast({
          title: 'Success',
          description: contactType === 'phone' ? 'OTP sent to your phone via SMS' : 'OTP sent to your email',
        });
        setResendAvailable(false);
        setResendSecondsLeft(30); // Start the countdown
        console.log('[OTP] send done'); // Dev-only console marker
      } else {
        if (data.code) {
          // Handle structured error response
          switch (data.code) {
            case 'RATE_LIMITED':
            case 'TOO_MANY_REQUESTS':
              setError('RATE_LIMITED');
              toast({
                title: 'Rate Limited',
                description: data.message || 'Too many OTP requests. Please try again later.',
                variant: 'destructive',
              });
              break;
            case 'INVALID_PHONE_FORMAT':
            case 'INVALID_INPUT':
              setError('INVALID_PHONE_FORMAT');
              toast({
                title: 'Invalid Phone Number',
                description: data.message || 'Please enter a valid Indian phone number (10 digits starting with 6-9)',
                variant: 'destructive',
              });
              break;
            case 'INVALID_EMAIL_FORMAT':
              setError('INVALID_EMAIL_FORMAT');
              toast({
                title: 'Invalid Email',
                description: data.message || 'Please enter a valid email address',
                variant: 'destructive',
              });
              break;
            default:
              setError('UNKNOWN_ERROR');
              toast({
                title: 'Error',
                description: data.message || 'Something went wrong, please try again.',
                variant: 'destructive',
              });
              break;
          }
        } else {
          // Handle legacy error response
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
              case 'Invalid email format':
                setError('INVALID_EMAIL_FORMAT');
                toast({
                  title: 'Invalid Email',
                  description: 'Please enter a valid email address',
                  variant: 'destructive',
                });
                break;
              default:
                const errorMsg = data.details || data.error || 'Something went wrong';
                setError(errorMsg);
                toast({
                  title: 'Error',
                  description: errorMsg,
                  variant: 'destructive',
                });
                break;
            }
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
      setAuthState('IDLE');
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

    // Prevent duplicate verification attempts
    if (authState === 'VERIFYING') {
      return;
    }

    console.log('[OTP] verify start'); // Dev-only console marker
    setAuthState('VERIFYING');
    setLoading(true);
    setError('');

    // Generate a simple device fingerprint (could be more sophisticated)
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : 'web-generic';
    const deviceFingerprint = `web-${btoa(userAgent.substring(0, 20)).substring(0, 10)}`;

    try {
      let verifyResponse;
      if (contactType === 'phone') {
        verifyResponse = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_e164: normalizePhone(contact),
            otp,
            device_fingerprint: deviceFingerprint,
            role_hint: 'customer',
          }),
        });
      } else {
        verifyResponse = await fetch('/api/auth/verify-email-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: contact,
            otp,
            device_fingerprint: deviceFingerprint,
            role_hint: 'customer',
          }),
        });
      }

      const data = await verifyResponse.json();

      if (verifyResponse.ok && data.success) {
        // After successful OTP verification
        setAuthState('AUTHED');

        // Optional: If Supabase tokens are provided, set them (Hybrid mode)
        if (data.session?.access_token && data.session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }

        // Logic for redirecting (moved out of nested API call)
        const userRole = data.role || 'customer';


        const dashboardRoute = getDashboardRouteForRole(userRole);
        console.log('[OTP] Redirection Debug:', { userRole, dashboardRoute, sanitizedRedirect });

        if (sanitizedRedirect && sanitizedRedirect !== '/') {
          // Check if customer is trying to access restricted app routes
          if (userRole === 'customer' && (
            sanitizedRedirect.startsWith('/app') ||
            sanitizedRedirect.startsWith('/admin') ||
            sanitizedRedirect.startsWith('/staff')
          )) {
            // Force customers to their dashboard (Home)
            console.log('[OTP] Redirecting to dashboard (forced):', dashboardRoute);
            window.location.href = dashboardRoute;
          } else {
            // Allow other redirects (e.g., deep links for authorized roles)
            console.log('[OTP] Redirecting to sanitizedRedirect:', sanitizedRedirect);
            window.location.href = sanitizedRedirect;
          }
        } else {
          // No specific redirect requested, go to default dashboard
          console.log('[OTP] Redirecting to dashboard (default):', dashboardRoute);
          window.location.href = dashboardRoute;
        }
        console.log('[OTP] verify done - redirection initiated');
      } else {
        // Handle error response with request_id
        if (data.request_id) {
          setLastRequestId(data.request_id);
        }

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
            case 'DEVICE_CONFLICT':
              setError('DEVICE_CONFLICT');
              toast({
                title: 'Device Conflict',
                description: data.message || 'Device conflict detected. Contact admin to unlock your account from previous device.',
                variant: 'destructive',
              });
              break;
            case 'DEVICE_FINGERPRINT_REQUIRED':
              setError('DEVICE_FINGERPRINT_REQUIRED');
              toast({
                title: 'Device Required',
                description: 'Device fingerprint is required for this role. Please try logging in from the correct device.',
                variant: 'destructive',
              });
              break;
            case 'USER_CREATION_ERROR':
              setError('USER_CREATION_ERROR');
              toast({
                title: 'Account Issue',
                description: 'There was an issue with your account. Please contact support.',
                variant: 'destructive',
              });
              break;
            default:
              setError('UNKNOWN_ERROR');
              toast({
                title: 'Error',
                description: data.message || 'Something went wrong, please try again.',
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
      setAuthState('OTP_SENT');
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!contact) {
      toast({
        title: 'Error',
        description: 'Please enter your contact first',
        variant: 'destructive',
      });
      return;
    }

    // Single-flight: if already sending, return
    if (authState === 'SENDING' || !resendAvailable) {
      return;
    }

    setAuthState('SENDING');
    setLoading(true);
    setError('');

    try {
      let response;
      if (contactType === 'phone') {
        const normalizedPhone = normalizePhone(contact);
        response = await fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone_e164: normalizedPhone,
            channel: 'sms',
          }),
        });
      } else {
        response = await fetch('/api/auth/request-email-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: contact,
          }),
        });
      }

      const data = await response.json();

      if (response.ok) {
        setCurrentStep('otp');
        setAuthState('OTP_SENT');
        toast({
          title: 'Success',
          description: contactType === 'phone' ? 'OTP sent to your phone via SMS' : 'OTP sent to your email',
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
            case 'Invalid email format':
              setError('INVALID_EMAIL_FORMAT');
              toast({
                title: 'Invalid Email',
                description: 'Please enter a valid email address',
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
      setAuthState('IDLE');
      setLoading(false);
    }
  };

  // Handle OTP input - move to next field when 1 digit is entered
  const handleOTPInput = (index: number, value: string) => {
    // Only allow digits or empty string
    if (/^\d$/.test(value) || value === '') {
      // Create a new array from the current OTP
      const newOtpArray = [...otp];
      // Ensure the array has 6 positions
      while (newOtpArray.length < 6) {
        newOtpArray.push('');
      }
      // Update the specific position
      newOtpArray[index] = value;
      // Join the array to form the new OTP string
      const newOtpString = newOtpArray.join('');
      // Update the state
      setOtp(newOtpString);

      // Move to next input if digit was entered and not on the last input
      if (value && index < 5) {
        otpInputRefs.current[index + 1]?.focus();
      }
    }
  };

  // Handle backspace to move to previous input
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">JamesTronic Login</CardTitle>
          <CardDescription className="text-center">
            Sign in with your phone number or email
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authState === 'AUTHED' ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-gray-600">Login successful! Redirecting...</p>
            </div>
          ) : currentStep === 'contact' ? (
            <div className="space-y-4">
              <div className="flex space-x-2 mb-4">
                <Button
                  type="button"
                  variant={contactType === 'phone' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setContactType('phone')}
                  disabled={loading}
                >
                  Phone
                </Button>
                {/* Email tab temporarily disabled for phone-only login */}
                <Button
                  type="button"
                  variant={contactType === 'email' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setContactType('email')}
                  disabled={true}
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  Email
                </Button>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact" className="text-sm font-medium">
                  {contactType === 'phone' ? 'Phone Number' : 'Email Address'}
                </label>
                {contactType === 'phone' ? (
                  <div className="flex space-x-2">
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-sm text-gray-500">+91</span>
                      <Input
                        ref={contactInputRef}
                        id="contact"
                        type="tel"
                        placeholder="9876543210"
                        value={contact}
                        onChange={(e) => setContact(e.target.value.trim())}
                        className="pl-8"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ) : (
                  <Input
                    ref={contactInputRef}
                    id="contact"
                    type="email"
                    placeholder="user@example.com"
                    value={contact}
                    onChange={(e) => setContact(e.target.value.trim())}
                    disabled={loading}
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {contactType === 'phone'
                    ? 'We\'ll send a one-time password to your phone via SMS'
                    : 'We\'ll send a one-time password to your email'}
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 p-2 bg-red-50 rounded-md">
                  {error === 'INVALID_PHONE_FORMAT' ? 'Please enter a valid 10-digit Indian phone number starting with 6-9' :
                    error === 'INVALID_EMAIL_FORMAT' ? 'Please enter a valid email address' :
                      error === 'RATE_LIMITED' ? 'Too many OTP requests. Please try again later.' :
                        error === 'UNKNOWN_ERROR' ? 'Something went wrong, please try again.' :
                          error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSendOTP}
                disabled={!canSendOtp}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>

              {/* Dev debug banner - only shown in development */}
              {process.env.NODE_ENV !== 'production' && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                  <div>DEBUG: authMethod={contactType}, loading={String(loading)}, resendAvailable={String(resendAvailable)}, authState={authState}, contactNormalized.length={contactNormalized.length}, contactValid={String(contactValid)}, canSendOtp={String(canSendOtp)}</div>
                </div>
              )}
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
                        ref={(el) => { otpInputRefs.current[index] = el; }}
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
                  Enter the OTP sent to {contactType === 'phone' ? 'your phone via SMS' : 'your email'}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Use the most recent OTP sent to your {contactType === 'phone' ? 'phone via SMS/WhatsApp' : 'email'}.
                  If you request a new OTP, the previous one becomes invalid.
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
                    <p className="text-sm text-gray-500">Resend OTP in <span className="font-medium">{resendSecondsLeft}</span>s</p>
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
                  {lastRequestId && (
                    <div className="text-xs mt-1 text-gray-600">
                      Request ID: {lastRequestId}
                    </div>
                  )}
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
                  onClick={() => setCurrentStep('contact')}
                  disabled={loading}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium disabled:opacity-50"
                >
                  Use different {contactType === 'phone' ? 'number' : 'email'}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}