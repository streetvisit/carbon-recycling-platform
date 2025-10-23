// Authentication utility for API calls
// Replaces mock tokens with real Clerk authentication

// Auth import removed for static build

export interface AuthHeaders {
  'Authorization': string;
  'Content-Type': string;
}

// Clerk instance singleton
let clerkInstance: any = null;

// Initialize Clerk if not already done
async function getClerkInstance() {
  if (typeof window === 'undefined') return null;
  
  if (clerkInstance) return clerkInstance;
  
  try {
    const Clerk = (await import('@clerk/clerk-js')).default;
    const publishableKey = (window as any).__CLERK_PUBLISHABLE_KEY || 
                          import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      console.warn('Clerk publishable key not found');
      return null;
    }
    
    clerkInstance = new Clerk(publishableKey);
    await clerkInstance.load();
    return clerkInstance;
  } catch (error) {
    console.error('Failed to initialize Clerk:', error);
    return null;
  }
}

// Get authentication headers for API calls
export async function getAuthHeaders(): Promise<AuthHeaders> {
  try {
    // Client-side: Use Clerk to get token
    if (typeof window !== 'undefined') {
      const clerk = await getClerkInstance();
      
      if (clerk?.session) {
        const token = await clerk.session.getToken();
        return {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        };
      }
      
      return {
        'Authorization': '',
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
  // In production, this should be the deployed API URL
  if (typeof window !== 'undefined') {
    // Client-side
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:8787'
      : 'https://api.carbonrecycling.co.uk'; // Production API URL
  } else {
    // Server-side
    return process.env.NODE_ENV === 'production'
      ? 'https://api.carbonrecycling.co.uk' // Production API URL
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