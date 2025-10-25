import { useEffect, useState } from 'preact/hooks';

interface ClerkAuth {
  token: string | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

/**
 * Hook to get Clerk authentication token
 * This works with Clerk's Astro integration for static sites
 */
export function useClerkAuth(): ClerkAuth {
  const [auth, setAuth] = useState<ClerkAuth>({
    token: null,
    isLoaded: false,
    isSignedIn: false,
    userId: null
  });

  useEffect(() => {
    async function loadClerkAuth() {
      try {
        // Try to get Clerk from global window object
        const clerk = (window as any).Clerk;
        
        if (!clerk) {
          console.warn('⚠️ Clerk not available on window object');
          setAuth(prev => ({ ...prev, isLoaded: true }));
          return;
        }

        // Wait for Clerk to load
        if (!clerk.loaded) {
          await new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              if (clerk.loaded) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 50);
            
            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve();
            }, 5000);
          });
        }

        // Get token from session
        let token = null;
        if (clerk.session) {
          token = await clerk.session.getToken();
        }

        setAuth({
          token,
          isLoaded: true,
          isSignedIn: !!clerk.user,
          userId: clerk.user?.id || null
        });

        console.log('✅ useClerkAuth loaded:', {
          hasToken: !!token,
          isSignedIn: !!clerk.user
        });
      } catch (error) {
        console.error('❌ Error loading Clerk auth:', error);
        setAuth(prev => ({ ...prev, isLoaded: true }));
      }
    }

    loadClerkAuth();
  }, []);

  return auth;
}

/**
 * Get Clerk token directly (for use outside React components)
 */
export async function getClerkToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    
    if (!clerk) {
      console.warn('⚠️ Clerk not found');
      return null;
    }

    // Wait for Clerk to load if needed
    if (!clerk.loaded) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (clerk.loaded) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      });
    }

    if (!clerk.session) {
      console.warn('⚠️ No Clerk session');
      return null;
    }

    const token = await clerk.session.getToken();
    if (token) {
      console.log('✅ Got token:', token.substring(0, 20) + '...');
    } else {
      console.warn('⚠️ Session exists but no token');
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error getting Clerk token:', error);
    return null;
  }
}
