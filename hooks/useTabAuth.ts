// hooks/useTabAuth.ts
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export const useTabAuth = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const checkTabAuth = (tabName: string) => {
    const protectedTabs = ['liked', 'add', 'chats', 'profile'];
    
    if (protectedTabs.includes(tabName) && !isAuthenticated) {
      router.replace('/auth/signin');
      return false;
    }
    
    return true;
  };

  return { checkTabAuth, isAuthenticated };
};