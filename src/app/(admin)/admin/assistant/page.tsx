'use client';

import { useState, useEffect, useRef } from 'react';
import { aiAssistantApi } from '@/lib/api/ai-assistant';
import { Message } from '@/lib/types/ai-assistant';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Plus, Sparkles, Bot, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function JamesAssistantPage() {
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    // Init conversation
    useEffect(() => {
        const init = async () => {
            try {
                // Create a fresh conversation for this session (in real app, list existing)
                const id = await aiAssistantApi.createConversation(`Chat ${new Date().toLocaleTimeString()}`);
                setConversationId(id);

                // Greet
                // In real app, AI sends greeting. Here we simulated.
            } catch (err) {
                console.error(err);
                toast({ title: 'Error', description: 'Could not connect to James AI.', variant: 'destructive' });
            }
        };
        init();
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !conversationId) return;

        const userText = input;
        setInput('');
        setLoading(true);

        // Optimistic update
        const optimUserMsg: Message = {
            id: 'temp-user',
            conversation_id: conversationId,
            sender: 'user',
            content: userText,
            meta_data: null,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimUserMsg]);

        try {
            const aiMsg = await aiAssistantApi.sendMessage(conversationId, userText);

            // Replace temp with real response (which is the AI message, but we also fetch history or just append)
            // The API returns the AI response. We need to fetch history to get the REAL user message ID, 
            // or just append AI response since we are optimistic.

            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            toast({ title: 'Failed to send', description: 'James is offline.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900">
            {/* Sidebar (Conversations) */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hidden md:flex flex-col">
                <div className="p-4 border-b">
                    <Button onClick={() => window.location.reload()} className="w-full gap-2" variant="outline">
                        <Plus className="h-4 w-4" /> New Chat
                    </Button>
                </div>
                <ScrollArea className="flex-1 p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">RECENT</div>
                    {/* Mock List */}
                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-start text-sm font-normal">
                            <Sparkles className="h-3 w-3 mr-2 text-blue-500" />
                            Revenue Analysis
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-sm font-normal">
                            <Sparkles className="h-3 w-3 mr-2 text-slate-400" />
                            System Health Check
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-sm font-normal">
                            <Sparkles className="h-3 w-3 mr-2 text-slate-400" />
                            Technician Scheduling
                        </Button>
                    </div>
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                <div className="p-4 border-b bg-white dark:bg-slate-950 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Bot className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-800 dark:text-slate-100">James AI</h2>
                            <p className="text-xs text-green-600 flex items-center gap-1">
                                <span className="block h-2 w-2 rounded-full bg-green-500"></span>
                                Online • Operational Copilot
                            </p>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4 bg-slate-50 dark:bg-slate-900">
                    <div className="space-y-4 max-w-3xl mx-auto">
                        {/* Default Greeting */}
                        {messages.length === 0 && (
                            <div className="text-center p-8 text-slate-400">
                                <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>Ask me about Revenue, System Status, or anything related to operations.</p>
                            </div>
                        )}

                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.sender === 'ai' && (
                                    <Avatar className="h-8 w-8 bg-indigo-100 border border-indigo-200">
                                        <Bot className="h-5 w-5 text-indigo-600 m-auto" />
                                    </Avatar>
                                )}

                                <div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.sender === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'
                                    }`}>
                                    {m.content}
                                </div>

                                {m.sender === 'user' && (
                                    <Avatar className="h-8 w-8 bg-slate-200">
                                        <User className="h-5 w-5 text-slate-600 m-auto" />
                                    </Avatar>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex gap-3">
                                <Avatar className="h-8 w-8 bg-indigo-100 border border-indigo-200">
                                    <Bot className="h-5 w-5 text-indigo-600 m-auto" />
                                </Avatar>
                                <div className="p-3 bg-white border rounded-2xl rounded-bl-none text-sm text-slate-400 italic">
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                <div className="p-4 bg-white dark:bg-slate-950 border-t">
                    <div className="max-w-3xl mx-auto flex gap-2">
                        <Input
                            placeholder="Ask James about daily revenue..."
                            className="flex-1"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <Button onClick={handleSend} disabled={loading || !input.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="text-center text-[10px] text-slate-400 mt-2">
                        James AI can make mistakes. Verify important operational data.
                    </div>
                </div>
            </div>
        </div>
    );
}
