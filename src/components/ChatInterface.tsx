import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Plus, 
  MessageSquare, 
  Trash2, 
  LogOut, 
  Menu, 
  X, 
  BookOpen, 
  Loader2,
  Mic,
  MicOff,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AppUser, Message, ChatSession } from '../types';
import { askQuestion, summarizeCurriculumSection, classifyConversation } from '../services/geminiService';

interface ChatInterfaceProps {
  user: AppUser;
  onLogout: () => void;
}

const CATEGORIES = [
  { id: 'nursing_basics_prac', name: 'أساسيات التمريض (عملي)', icon: BookOpen },
  { id: 'nursing_basics_theory', name: 'أساسيات التمريض (نظري)', icon: BookOpen },
  { id: 'biology', name: 'الأحياء', icon: BookOpen },
  { id: 'social_studies', name: 'الدراسات الاجتماعية', icon: BookOpen },
  { id: 'anatomy', name: 'التشريح والوظائف', icon: BookOpen },
  { id: 'english', name: 'اللغة الإنجليزية', icon: BookOpen },
  { id: 'religion', name: 'التربية الدينية', icon: BookOpen },
  { id: 'math', name: 'الرياضيات', icon: BookOpen },
  { id: 'science', name: 'العلوم التطبيقية', icon: BookOpen },
  { id: 'arabic', name: 'اللغة العربية', icon: BookOpen },
];

export default function ChatInterface({ user, onLogout }: ChatInterfaceProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatCategory, setNewChatCategory] = useState(CATEGORIES[0].id);
  
  // Summary Modal State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summarySubject, setSummarySubject] = useState('أساسيات التمريض (عملي)');
  const [summarySection, setSummarySection] = useState('');
  const [summaryLanguage, setSummaryLanguage] = useState('العربية');

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem(`chat_sessions_${user.username}`);
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
  }, [user.username]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(`chat_sessions_${user.username}`, JSON.stringify(sessions));
    }
  }, [sessions, user.username]);

  // Update current messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        setMessages(session.messages);
      }
    } else {
      setMessages([]);
    }
  }, [currentSessionId, sessions]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ar-EG';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const createNewSession = (category: string) => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'محادثة جديدة',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category,
      userId: user.username
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsNewChatModalOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
    // If sessions become empty, clear localStorage
    if (sessions.length === 1) {
      localStorage.removeItem(`chat_sessions_${user.username}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      const newId = Date.now().toString();
      const newSession: ChatSession = {
        id: newId,
        title: input.slice(0, 30) + '...',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: CATEGORIES[0].id,
        userId: user.username
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
      sessionId = newId;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askQuestion(input, updatedMessages);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Update session in list
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          // Auto-title if it's the first message
          const title = s.messages.length === 0 ? input.slice(0, 30) + '...' : s.title;
          return { ...s, messages: finalMessages, updatedAt: Date.now(), title };
        }
        return s;
      }));

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summarySection.trim() || isLoading) return;

    setIsLoading(true);
    setIsSummaryModalOpen(false);

    try {
      const summary = await summarizeCurriculumSection(summarySubject, summarySection, summaryLanguage);
      
      let sessionId = currentSessionId;
      if (!sessionId) {
        const newId = Date.now().toString();
        const newSession: ChatSession = {
          id: newId,
          title: `تلخيص: ${summarySection}`,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          category: CATEGORIES.find(c => summarySubject.includes(c.name))?.id || CATEGORIES[0].id,
          userId: user.username
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newId);
        sessionId = newId;
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: summary,
        timestamp: Date.now()
      };

      const finalMessages = [...messages, assistantMessage];
      setMessages(finalMessages);

      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: finalMessages, updatedAt: Date.now() };
        }
        return s;
      }));

    } catch (error) {
      console.error("Summary error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const MessageBubble = ({ msg }: { msg: Message }) => (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex gap-3 max-w-[85%] md:max-w-[75%]",
        msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto"
      )}
    >
      <div className={cn(
        "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1",
        msg.role === 'user' ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-indigo-600"
      )}>
        {msg.role === 'user' ? <User className="w-4 h-4 md:w-5 md:h-5" /> : <Bot className="w-4 h-4 md:w-5 md:h-5" />}
      </div>
      <div className={cn(
        "p-4 md:p-5 rounded-2xl shadow-sm relative group",
        msg.role === 'user' 
          ? "bg-indigo-600 text-white rounded-tl-sm" 
          : "bg-white border border-slate-200 text-slate-800 rounded-tr-sm"
      )}>
        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap text-right" dir="rtl">
          {msg.content}
        </p>
        {msg.timestamp && (
          <span className={cn(
            "text-[10px] mt-2 block opacity-50",
            msg.role === 'user' ? "text-indigo-100" : "text-slate-400"
          )}>
            {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  );

  const TypingIndicator = () => (
    <div className="flex gap-1">
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
        className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
        className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
        className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
      />
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden" dir="rtl">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-72 bg-white border-l border-slate-200 z-50 transition-transform duration-300 lg:relative lg:translate-x-0 flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <Bot className="text-white w-5 h-5" />
            </div>
            <h2 className="font-bold text-slate-800 text-lg">مساعد التمريض</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            محادثة جديدة
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-slate-500">
                  <cat.icon className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">{cat.name}</h3>
                </div>
              </div>
              
              <div className="space-y-1">
                {sessions.filter(s => s.category === cat.id).length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-2 italic">لا توجد محادثات</p>
                ) : (
                  sessions.filter(s => s.category === cat.id).map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setCurrentSessionId(session.id);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full p-2.5 rounded-xl flex items-center gap-3 transition-all group text-right cursor-pointer",
                        currentSessionId === session.id 
                          ? "bg-indigo-600 text-white shadow-md" 
                          : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <MessageSquare className={cn(
                        "w-4 h-4 shrink-0",
                        currentSessionId === session.id ? "text-indigo-100" : "text-slate-400"
                      )} />
                      <span className="flex-1 truncate text-xs font-medium">{session.title}</span>
                      <button
                        type="button"
                        onClick={(e) => deleteSession(session.id, e)}
                        className={cn(
                          "p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                          currentSessionId === session.id ? "hover:bg-indigo-500 text-indigo-100" : "hover:bg-slate-200 text-slate-400"
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onLogout}
            className="w-full py-2 px-4 bg-slate-50 text-slate-600 rounded-xl flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpen className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">مساعد التمريض الذكي</h1>
              <p className="text-[10px] md:text-xs text-slate-500">مرحباً، {user.displayName || user.username}</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg lg:hidden"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-80">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
                <Bot className="w-10 h-10 text-indigo-600" />
              </div>
              <div className="max-w-md px-4">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">كيف يمكنني مساعدتك اليوم؟</h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  أنا مدرب على الإجابة من جميع الكتب و المناهج الخاصة بمدارس التمريض (الصف الأول الثانوي).
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-8">
                {[
                  "ما هي خطوات غسيل الأيدي؟",
                  "اشرح لي مكونات الخلية الحيوانية",
                  "ما هي العوامل المؤثرة على توزيع الأمراض؟",
                  "لخص لي فصل العلامات الحيوية"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-3 text-sm text-right bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-slate-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-3 ml-auto max-w-[80%]">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
                <Bot className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
              </div>
              <div className="p-4 md:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm rounded-tr-sm flex items-center gap-3">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4 md:p-6 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] z-10">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSummaryModalOpen(true)}
              disabled={isLoading}
              className="p-3 md:p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 hover:text-indigo-600"
              title="تلخيص جزء من المنهج"
            >
              <FileText className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <div className="relative flex-1 group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسأل عن أي شيء في المنهج..."
                className="w-full pr-4 pl-12 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-right shadow-sm group-hover:border-slate-300"
                dir="rtl"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-sm active:scale-95"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            
            {recognitionRef.current && (
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "p-3 md:p-4 rounded-xl transition-all shadow-sm flex items-center justify-center",
                  isListening 
                    ? "bg-red-500 text-white animate-pulse shadow-red-500/20" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600"
                )}
              >
                {isListening ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
            )}
          </form>
          <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
            هذا المساعد مخصص لأغراض تعليمية فقط. يرجى مراجعة الكتب الرسمية دائماً.
          </p>
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewChatModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="text-indigo-600" />
                  محادثة جديدة
                </h2>
                <button onClick={() => setIsNewChatModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                createNewSession(newChatCategory);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المادة الدراسية</label>
                  <select
                    value={newChatCategory}
                    onChange={(e) => setNewChatCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm mt-4"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء محادثة
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Summary Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSummaryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-indigo-600" />
                  تلخيص جزء من المنهج
                </h2>
                <button onClick={() => setIsSummaryModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSummarize} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المادة الدراسية</label>
                  <select
                    value={summarySubject}
                    onChange={(e) => setSummarySubject(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الجزء المراد تلخيصه (مثال: الخلية، غسيل الأيدي)</label>
                  <input
                    type="text"
                    value={summarySection}
                    onChange={(e) => setSummarySection(e.target.value)}
                    placeholder="اكتب اسم الجزء أو الفصل..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">لغة التلخيص</label>
                  <select
                    value={summaryLanguage}
                    onChange={(e) => setSummaryLanguage(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="العربية">العربية</option>
                    <option value="الإنجليزية">الإنجليزية</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!summarySection.trim() || isLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-4"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بدء التلخيص'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
