// Authentication utility for API calls
// Replaces mock tokens with real Clerk authentication

import { useAuth as useClerkAuth } from '@clerk/clerk-preact';

export interface AuthHeaders {
  'Authorization': string;
  'Content-Type': string;
}

// Get API base URL based on environment
export function getApiBaseUrl(): string {
  // Check for explicit environment variable first
  if (import.meta.env.API_BASE_URL) {
    return import.meta.env.API_BASE_URL;
  }
  
  // Fallback to environment-based logic
  if (typeof window !== 'undefined') {
    // Client-side - for development, use mock data; for production, use real API
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:8787';
    } else {
      // Production: Use the actual API URL from your Cloudflare deployment
      return 'https://carbon-recycling-api.charles-39b.workers.dev';
    }
  } else {
    // Server-side
    return process.env.NODE_ENV === 'production'
      ? 'https://carbon-recycling-api.charles-39b.workers.dev'
      : 'http://localhost:8787';
  }
}

// Authenticated fetch wrapper with retry logic
export async function authenticatedFetch(
  url: string, 
  options: RequestInit = {},
  retryCount: number = 3
): Promise<Response> {
  let token: string | null = null;
  
  try {
    // Try to get token from Clerk
    if (typeof window !== 'undefined') {
      // Client-side: Use Clerk's client-side API
      const { Clerk } = await import('@clerk/clerk-js');
      const clerk = Clerk.getInstance();
      if (clerk && clerk.user) {
        token = await clerk.session?.getToken();
      }
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };
  
  const makeRequest = async (attempt: number = 1): Promise<Response> => {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      // If token expired and we have retries left, try to refresh and retry
      if (response.status === 401 && attempt <= retryCount && typeof window !== 'undefined') {
        console.log(`Auth failed (attempt ${attempt}/${retryCount}), trying to refresh token...`);
        
        try {
          // Try to refresh the token
          const { Clerk } = await import('@clerk/clerk-js');
          const clerk = Clerk.getInstance();
          if (clerk && clerk.session) {
            const newToken = await clerk.session.getToken({ skipCache: true });
            if (newToken) {
              // Update headers with new token
              const newHeaders = {
                ...headers,
                'Authorization': `Bearer ${newToken}`
              };
              
              // Wait a bit before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
              
              // Retry with new token
              return fetch(url, {
                ...options,
                headers: newHeaders,
              });
            }
          }
        } catch (refreshError) {
          console.warn('Failed to refresh token:', refreshError);
        }
        
        // If we can't refresh, try again with original token after a delay
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
          return makeRequest(attempt + 1);
        }
      }
      
      // For other errors, retry with exponential backoff
      if (!response.ok && response.status >= 500 && attempt <= retryCount) {
        console.log(`Request failed with ${response.status} (attempt ${attempt}/${retryCount}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        return makeRequest(attempt + 1);
      }
      
      return response;
    } catch (networkError) {
      // Retry network errors
      if (attempt <= retryCount) {
        console.log(`Network error (attempt ${attempt}/${retryCount}), retrying...`, networkError.message);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        return makeRequest(attempt + 1);
      }
      throw networkError;
    }
  };
  
  return makeRequest();
}

// Error handling for auth failures
export class AuthError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AuthError';
  }
}

// Handle auth errors in API responses  
export function handleAuthError(response: Response): void {
  if (response.status === 401) {
    console.warn('Authentication required. Please sign in.');
    
    // Show user-friendly notification
    showAuthNotification('Authentication required. Please sign in again.', 'error');
    
    // Clear any existing auth state
    try {
      localStorage.removeItem('clerk-auth-token');
    } catch (e) {}
    
    // Redirect to sign-in after a brief delay
    setTimeout(() => {
      window.location.href = '/sign-in?redirect=' + encodeURIComponent(window.location.pathname);
    }, 2000);
    
    // Dispatch event for components that need to react
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { redirect: true } }));
  }
  
  if (response.status === 403) {
    console.warn('Access forbidden. Check your permissions.');
    showAuthNotification('Access denied. You do not have permission to perform this action.', 'error');
    window.dispatchEvent(new CustomEvent('auth:forbidden', { detail: { status: 403 } }));
  }
}

// Show auth-related notifications to users
function showAuthNotification(message: string, type: 'error' | 'warning' | 'info' = 'info'): void {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border-l-4 ${
    type === 'error' ? 'border-red-500' : type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
  } p-4 transition-all duration-300 transform translate-x-full`;
  
  notification.innerHTML = `
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <svg class="h-5 w-5 ${
          type === 'error' ? 'text-red-400' : type === 'warning' ? 'text-yellow-400' : 'text-blue-400'
        }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${
            type === 'error' 
              ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
              : type === 'warning'
              ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
              : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
          }
        </svg>
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium text-gray-800">${message}</p>
      </div>
      <div class="ml-auto pl-3">
        <div class="-mx-1.5 -my-1.5">
          <button class="inline-flex bg-white rounded-md p-1.5 text-gray-400 hover:text-gray-500 focus:outline-none" onclick="this.parentElement.parentElement.parentElement.parentElement.remove()">
            <span class="sr-only">Dismiss</span>
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const { Clerk } = require('@clerk/clerk-js');
      const clerk = Clerk.getInstance();
      return !!(clerk && clerk.user);
    }
    return false;
  } catch (error) {
    return false;
  }
}