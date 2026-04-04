import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import { Loader2 } from 'lucide-react';
import { AppUser } from './types';

export default function App() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Default user to bypass login
  const defaultUser: AppUser = {
    username: 'admin',
    displayName: 'المطور الرئيسي',
    role: 'admin',
    status: 'active',
    isDeveloper: true,
    requiresPasswordChange: false,
    createdAt: new Date(),
    lastLogin: new Date(),
  };

  useEffect(() => {
    const init = async () => {
      // Simulate initialization delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsAuthChecking(false);
    };

    init();
  }, []);

  const handleLogout = () => {
    // In a no-login app, logout could just refresh
    window.location.reload();
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ChatInterface user={defaultUser} onLogout={handleLogout} />
    </div>
  );
}
