import { sha256 } from 'crypto-hash';

/**
 * Generates a device fingerprint based on various browser characteristics
 * @returns Promise<string> - SHA-256 hash of the device fingerprint
 */
export async function generateDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side, return a placeholder or handle appropriately
    return 'server-side';
  }

  // Collect device characteristics
  const deviceInfo = {
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    timezoneOffset: new Date().getTimezoneOffset(),
    screenResolution: `${screen.width}x${screen.height}`,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    canvasHash: getCanvasFingerprint(),
    webglVendor: getWebGLVendor(),
    language: navigator.language || 'unknown',
    cookieEnabled: navigator.cookieEnabled,
    vendor: navigator.vendor || 'unknown',
  };

  // Create a string representation of device info
  const deviceString = Object.entries(deviceInfo)
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

  // Return SHA-256 hash of the device string
  return await sha256(deviceString);
}

/**
 * Generates a canvas fingerprint by drawing a test pattern
 * @returns string - Hash of the canvas content
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-context';

    // Draw a test pattern
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Canvas fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas fingerprint', 4, 17);

    // Get the canvas data
    const canvasData = canvas.toDataURL();
    return btoa(canvasData).substring(0, 32); // Take first 32 chars as a simple hash
  } catch (e) {
    return 'error';
  }
}

/**
 * Gets WebGL vendor information for fingerprinting
 * @returns string - WebGL vendor and renderer info
 */
function getWebGLVendor(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
    if (!gl) return 'no-webgl';

    // Get WebGL parameters
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return `${vendor || 'unknown'}|${renderer || 'unknown'}`;
    }

    return 'standard-webgl';
  } catch (e) {
    return 'error';
  }
}

/**
 * Checks if the user's device matches the expected fingerprint
 * @param expectedFingerprint - The stored device fingerprint to compare against
 * @returns Promise<boolean> - True if devices match
 */
export async function verifyDeviceMatch(expectedFingerprint: string): Promise<boolean> {
  const currentFingerprint = await generateDeviceFingerprint();
  return currentFingerprint === expectedFingerprint;
}