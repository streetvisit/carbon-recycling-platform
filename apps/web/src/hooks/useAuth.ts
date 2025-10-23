// Custom authentication hooks for Preact components
import { useState, useEffect } from 'preact/hooks';
import { authenticatedFetch, getApiBaseUrl, handleAuthError } from '../utils/auth';
import Clerk from '@clerk/clerk-js';

// Minimal auth state interface
interface AuthState {
  isSignedIn: boolean;
  isLoaded: boolean;
  getToken: () => Promise<string | null>;
}

// Initialize Clerk instance (singleton)
let clerkInstance: Clerk | null = null;

// Clerk auth hook for client-side Preact components
function useClerkAuth(): AuthState {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function initClerk() {
      if (typeof window === 'undefined') return;
      
      try {
        // Get publishable key from window or env
        const publishableKey = (window as any).__CLERK_PUBLISHABLE_KEY || 
                              import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
        
        if (!publishableKey) {
          console.warn('Clerk publishable key not found');
          setIsLoaded(true);
          return;
        }

        if (!clerkInstance) {
          clerkInstance = new Clerk(publishableKey);
          await clerkInstance.load();
        }
        
        setIsSignedIn(!!clerkInstance.user);
        setIsLoaded(true);

        // Listen for auth state changes
        clerkInstance.addListener(() => {
          setIsSignedIn(!!clerkInstance?.user);
        });
      } catch (error) {
        console.error('Failed to initialize Clerk:', error);
        setIsLoaded(true);
      }
    }

    initClerk();
  }, []);

  const getToken = async () => {
    if (!clerkInstance?.session) return null;
    try {
      return await clerkInstance.session.getToken();
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  };

  return { isSignedIn, isLoaded, getToken };
}

// Hook for authenticated API calls with loading state
export function useAuthenticatedApi<T = any>(
  url?: string,
  options?: RequestInit,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useClerkAuth();

  const fetchData = async (customUrl?: string, customOptions?: RequestInit) => {
    if (!isSignedIn) {
      setError('Please sign in to access this data');
      return;
    }

    const apiUrl = customUrl || url;
    if (!apiUrl) return;

    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(apiUrl, customOptions || options);
      
      if (!response.ok) {
        handleAuthError(response);
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('API request failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount and dependency changes
  useEffect(() => {
    if (url && isSignedIn) {
      fetchData();
    }
  }, [url, isSignedIn, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
    setError
  };
}

// Hook for form submissions with auth
export function useAuthenticatedSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { isSignedIn } = useClerkAuth();

  const submit = async (url: string, data: any, options: RequestInit = {}) => {
    if (!isSignedIn) {
      setError('Please sign in to submit data');
      return false;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        ...options,
      });

      if (!response.ok) {
        handleAuthError(response);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Submit failed: ${response.status}`);
      }

      setSuccess(true);
      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  return {
    submit,
    loading,
    error,
    success,
    reset
  };
}

// Hook for authentication state management
export function useAuthState() {
  const clerkAuth = useClerkAuth();
  const [apiBaseUrl] = useState(getApiBaseUrl());

  // Enhanced auth state with additional helpers
  return {
    ...clerkAuth,
    apiBaseUrl,
    isAuthenticated: clerkAuth.isSignedIn,
    hasRole: (role: string) => {
      // You can extend this to check specific roles if your app uses them
      return clerkAuth.isSignedIn;
    },
    canAccess: (permission: string) => {
      // You can extend this for permission-based access control
      return clerkAuth.isSignedIn;
    }
  };
}

// Hook for handling auth events
export function useAuthEvents() {
  useEffect(() => {
    const handleAuthRequired = (event: CustomEvent) => {
      console.log('Auth required event:', event.detail);
      // Additional handling if needed
    };

    const handleAuthForbidden = (event: CustomEvent) => {
      console.log('Auth forbidden event:', event.detail);
      // Additional handling if needed
    };

    window.addEventListener('auth:required', handleAuthRequired as EventListener);
    window.addEventListener('auth:forbidden', handleAuthForbidden as EventListener);

    return () => {
      window.removeEventListener('auth:required', handleAuthRequired as EventListener);
      window.removeEventListener('auth:forbidden', handleAuthForbidden as EventListener);
    };
  }, []);
}

// Hook for API data with automatic refresh
export function useApiData<T = any>(endpoint: string, refreshInterval?: number) {
  const { data, loading, error, refetch } = useAuthenticatedApi<T>(
    `${getApiBaseUrl()}${endpoint}`
  );

  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        refetch();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, refetch]);

  return { data, loading, error, refetch };
}