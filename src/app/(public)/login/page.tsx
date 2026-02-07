import { Suspense } from 'react';
import OTPLoginPageWrapper from './page-wrapper';

export default function OTPLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading login page...</div>}>
      <OTPLoginPageWrapper />
    </Suspense>
  );
}