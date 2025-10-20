// Version tracking for deployment debugging
export const PLATFORM_VERSION = "v2024.10.20-18:19-critical-fixes";
export const BUILD_TIMESTAMP = "2024-10-20T18:19:26Z";

// Log version info to console for debugging
export function logPageVersion(pageName: string) {
  console.group(`🔧 ${pageName} - Debug Info`);
  console.log(`📦 Platform Version: ${PLATFORM_VERSION}`);
  console.log(`🕒 Build Timestamp: ${BUILD_TIMESTAMP}`);
  console.log(`📄 Page: ${pageName}`);
  console.log(`🌐 Current URL: ${window.location.href}`);
  console.log(`⏰ Page Load Time: ${new Date().toISOString()}`);
  console.groupEnd();
}