import { createContext, useContext, type ReactNode } from 'react';
import { useUser } from '../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const { data: user, isLoading } = useUser();
  const queryClient = useQueryClient();

  const login = () => {
    // We should not use navigation() here because this needs to b  e a full page redirect to the Discord OAuth flow
    // Using React Router navigation would only change the client-side route but not actually redirect to Discord
    window.location.href = '/auth/discord';
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'GET',
        credentials: 'include'
      });
      // Invalidate all queries to clear the cache
      await queryClient.invalidateQueries();
      // Clear the cache
      queryClient.clear();
      // Reload the page to reset the app state
      window.location.reload();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 