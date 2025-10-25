// Authentication utility for API calls
// Uses Clerk session from global window object

export interface AuthHeaders {
  'Authorization': string;
  'Content-Type': string;
}

// Get Clerk session token from global Clerk instance
async function getClerkToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    // Try multiple ways to access Clerk
    let clerk = (window as any).Clerk;
    
    // If not found, try __clerk_internal_clerk (used by some Clerk versions)
    if (!clerk) {
      clerk = (window as any).__clerk_internal_clerk;
    }
    
    // If still not found, try getting from __clerk_session
    if (!clerk) {
      const sessionData = (window as any).__clerk_session;
      if (sessionData?.token) {
        console.log('✅ Found Clerk token from __clerk_session');
        return sessionData.token;
      }
    }
    
    if (!clerk) {
      console.warn('❌ Clerk not found on window object. Available keys:', Object.keys(window).filter(k => k.toLowerCase().includes('clerk')));
      return null;
    }
    
    console.log('✅ Found Clerk instance, loaded:', clerk.loaded);
    
    // Wait for Clerk to be loaded if not ready
    if (!clerk.loaded) {
      console.log('⏳ Waiting for Clerk to load...');
      await new Promise((resolve) => {
        const checkLoaded = setInterval(() => {
          if (clerk.loaded) {
            clearInterval(checkLoaded);
            console.log('✅ Clerk loaded successfully');
            resolve(true);
          }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkLoaded);
          console.warn('⚠️ Clerk load timeout');
          resolve(false);
        }, 5000);
      });
    }
    
    // Get session token
    if (clerk.session) {
      const token = await clerk.session.getToken();
      if (token) {
        console.log('✅ Got Clerk session token:', token.substring(0, 20) + '...');
        return token;
      } else {
        console.warn('⚠️ Clerk session exists but no token returned');
      }
    } else {
      console.warn('⚠️ No Clerk session found');
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to get Clerk token:', error);
    return null;
  }
}

// Get authentication headers for API calls
export async function getAuthHeaders(): Promise<AuthHeaders> {
  try {
    // Client-side: Use Clerk to get token
    if (typeof window !== 'undefined') {
      const token = await getClerkToken();
      
      return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      };
    } else {
      // Server-side: Auth disabled for static build
      return {
        'Authorization': '',
        'Content-Type': 'application/json'
      };
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
    return {
      'Authorization': '',
      'Content-Type': 'application/json'
    };
  }
}

// Get API base URL based on environment
export function getApiBaseUrl(): string {
  // Use environment variable or default to Workers API
  if (typeof window !== 'undefined') {
    // Client-side
    const apiUrl = import.meta.env.PUBLIC_API_BASE_URL;
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:8787'
      : (apiUrl || 'https://carbon-recycling-api.charles-39b.workers.dev/api/v1');
  } else {
    // Server-side
    return process.env.NODE_ENV === 'production'
      ? (process.env.PUBLIC_API_BASE_URL || 'https://carbon-recycling-api.charles-39b.workers.dev/api/v1')
      : 'http://localhost:8787';
  }
}

// Authenticated fetch wrapper
export async function authenticatedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  try {
    if (typeof window !== 'undefined') {
      // Client-side check - this is a simplified check
      // In a real implementation, you'd check Clerk's auth state
      return !!localStorage.getItem('clerk-auth-token'); // Simplified
    }
    return false;
  } catch (error) {
    return false;
  }
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
    throw new AuthError('Authentication required. Please sign in.', 401);
  }
  if (response.status === 403) {
    throw new AuthError('Access forbidden. Check your permissions.', 403);
  }
}