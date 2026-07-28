import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Send,
  Loader2,
  Leaf,
  Bug,
  Cloud,
  DollarSign,
  Sprout,
  Beef,
  Zap,
  Sparkles,
  Mic,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RotateCcw,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ============================================================
// Suggestion Chips
// ============================================================

const suggestions = [
  { icon: Leaf, label: "Crop Health", prompt: "How can I improve the health of my tomato crops?" },
  { icon: Bug, label: "Pest Control", prompt: "What are natural ways to control aphids on vegetables?" },
  { icon: Cloud, label: "Weather Tips", prompt: "How should I prepare my farm for heavy rainfall?" },
  { icon: DollarSign, label: "Market Prices", prompt: "What are current maize prices in Kenya?" },
  { icon: Sprout, label: "Planting Guide", prompt: "What's the best time to plant beans in East Africa?" },
  { icon: Beef, label: "Livestock Care", prompt: "How do I maintain healthy cattle during dry season?" },
];



// ============================================================
// Chat Message Component
// ============================================================

function ChatMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      {message.role === "assistant" && (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div
        className={`max-w-[80%] rounded-2xl p-4 ${
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border/50"
        }`}
      >
        <div className="prose prose-sm max-w-none">
          {message.content.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return (
                <h3 key={i} className="text-sm font-bold mt-3 mb-1">
                  {line.replace(/\*\*/g, "")}
                </h3>
              );
            }
            if (line.startsWith("• ")) {
              return (
                <div key={i} className="flex items-start gap-2 ml-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{line.slice(2)}</span>
                </div>
              );
            }
            if (line.trim() === "") {
              return <div key={i} className="h-2" />;
            }
            return (
              <p key={i} className="text-sm leading-relaxed">
                {line}
              </p>
            );
          })}
        </div>
        
        {message.role === "assistant" && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ThumbsUp className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ThumbsDown className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
      
      {message.role === "user" && (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary shrink-0">
          <User className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
// Main AI Assistant Page
// ============================================================

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI Farming Assistant 🌱\n\nI can help you with:\n• Crop management and disease identification\n• Pest control solutions\n• Weather-based farming advice\n• Market prices and trends\n• Livestock care tips\n• Farm planning and budgeting\n\nAsk me anything about farming, and I'll provide detailed, actionable advice!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatWithAI = useAction(api.aiAssistant.chatWithAI);

  const handleSend = useCallback(async (content?: string) => {
    const messageContent = content || input.trim();
    if (!messageContent || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.slice(-6).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

      const result = await chatWithAI({
        message: messageContent,
        history: history,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error processing your request. Please make sure the GROQ_API_KEY is configured in your environment, or try again later.\n\nGet a free key at https://console.groq.com — 14,400 requests/day free.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, chatWithAI]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
        {/* Header */}
        <div className="border-b border-border bg-background/95 backdrop-blur-xl px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">AI Farming Assistant</h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">Online • Ready to help</span>
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              <Sparkles className="w-3 h-3 mr-1 text-primary" />
              Powered by Groq AI
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {messages.length <= 1 && (
          <div className="px-4 md:px-6 pb-2">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, i) => {
                const Icon = suggestion.icon;
                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleSend(suggestion.prompt)}
                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {suggestion.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border bg-background/95 backdrop-blur-xl p-4 md:px-6">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" className="shrink-0 mb-1">
              <Paperclip className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about farming..."
                className="min-h-[48px] pr-12 rounded-xl"
                disabled={isLoading}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 mb-0"
              >
                <Mic className="w-5 h-5" />
              </Button>
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="shrink-0 gradient-primary mb-1"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            AI responses are generated based on agricultural best practices. Always verify with local experts.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
