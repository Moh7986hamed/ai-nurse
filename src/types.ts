export interface AppUser {
  username: string;
  displayName?: string;
  role: 'student' | 'admin';
  status: 'active' | 'inactive';
  isDeveloper: boolean;
  requiresPasswordChange?: boolean;
  createdAt: Date | number;
  lastLogin: Date | number;
  password?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  category: string;
  userId: string;
}
