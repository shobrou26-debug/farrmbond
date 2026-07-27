import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
// AI Response Generation (simulated)
// ============================================================

function generateAIResponse(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes("tomato") || lowerQuery.includes("crop health")) {
    return `Great question about tomato crop health! Here are my recommendations:

**Nutrition Management:**
• Apply balanced NPK fertilizer (10-10-10) during vegetative stage
• Switch to high-potassium fertilizer during fruiting
• Ensure adequate calcium to prevent blossom end rot

**Water Management:**
• Maintain consistent soil moisture (60-70% field capacity)
• Use drip irrigation to reduce leaf wetness
• Water deeply but less frequently to encourage deep root growth

**Disease Prevention:**
• Practice crop rotation (3-year minimum)
• Remove plant debris after harvest
• Apply organic mulch to prevent soil-borne diseases
• Monitor for early blight and late blight signs

**Best Practices:**
• Prune lower leaves to improve air circulation
• Stake or cage plants for support
• Monitor pH levels (6.0-6.8 ideal for tomatoes)

Would you like me to elaborate on any of these points?`;
  }
  
  if (lowerQuery.includes("pest") || lowerQuery.includes("aphid")) {
    return `Here are effective natural pest control methods for aphids and other common pests:

**Biological Control:**
• Release ladybugs - they consume up to 50 aphids daily
• Attract lacewings with dill, fennel, or yarrow
• Encourage predatory wasps with flowering plants

**Organic Sprays:**
• Neem oil solution (2 tbsp per liter of water)
• Garlic spray (blend 2 garlic bulbs, strain, dilute)
• Chili pepper spray for repelling soft-bodied insects

**Companion Planting:**
• Plant marigolds to deter aphids
• Use nasturtiums as trap crops
• Interplant with strong-scented herbs (basil, mint)

**Cultural Practices:**
• Inspect plants regularly for early detection
• Remove heavily infested leaves
• Use reflective mulch to disorient flying pests
• Ensure proper plant spacing for air circulation

Prevention is always better than cure - maintain healthy soil and plants to naturally resist pest attacks!`;
  }
  
  if (lowerQuery.includes("rain") || lowerQuery.includes("weather")) {
    return `Here's how to prepare your farm for heavy rainfall:

**Before the Rain:**
• Ensure proper drainage channels are clear
• Harvest any mature crops immediately
• Stake young plants that might be damaged by wind
• Cover sensitive crops with protective sheets

**Soil Management:**
• Create raised beds if your soil is prone to waterlogging
• Add organic matter to improve soil structure and drainage
• Avoid working wet soil to prevent compaction
• Consider cover crops to prevent soil erosion

**Post-Rain Care:**
• Check for crop damage and disease signs
• Allow soil to dry before any field work
• Apply preventive fungicide if needed
• Replant any damaged crops promptly

**Infrastructure:**
• Check and repair farm roads and paths
• Ensure water harvesting systems are ready
• Verify storage facilities are waterproof

Would you like specific advice for your farm's soil type?`;
  }
  
  if (lowerQuery.includes("maize") || lowerQuery.includes("price")) {
    return `Current maize market information for East Africa:

**Kenya (NAFARM):**
• Grade 1 Maize: KES 3,800-4,200 per 90kg bag
• Grade 2 Maize: KES 3,200-3,600 per 90kg bag
• Trend: Stable with slight upward pressure

**Market Factors:**
• Current demand is moderate
• Import volumes affecting local prices
• Quality premium for well-dried maize (13.5% moisture)

**Tips to Maximize Returns:**
• Store properly in hermetic bags to maintain quality
• Sell when prices peak (usually July-September)
• Consider value addition (maize flour processing)
• Join cooperative societies for better bargaining power

**Price Forecast:**
• Expect moderate price increases as stocks deplete
• Plant now for harvest during peak demand season
• Monitor NCPB and county market prices weekly

For real-time prices, check your local agricultural market or the e-NAM platform.`;
  }
  
  if (lowerQuery.includes("bean") || lowerQuery.includes("planting")) {
    return `Optimal planting guide for beans in East Africa:

**Best Planting Times:**
• Long rains: March-April (main season)
• Short rains: October-November
• Avoid planting during peak dry season

**Soil Requirements:**
• Well-drained loamy soil (pH 6.0-7.0)
• Temperature: 18-27°C optimal
• Add compost or manure before planting

**Planting Method:**
• Row spacing: 45-60 cm apart
• Plant spacing: 10-15 cm between plants
• Seed depth: 3-5 cm
• Inoculate seeds with Rhizobium bacteria

**Varieties for East Africa:**
• Rose Coco (GLP-2): High yielding, early maturing
• Mwezi Moja: Drought tolerant
• Pinto: Disease resistant
• Calico: Good for intercropping

**Key Management Tips:**
• Weed within 3 weeks of planting
• Apply phosphorus fertilizer at planting
• Scout for bean fly and pod borers
• Harvest when pods are dry and brown

Beans fix nitrogen, making them excellent for rotation!`;
  }
  
  return `Thank you for your question! As your AI Farming Assistant, I can help you with:

🌾 **Crop Management** - Planting guides, disease control, nutrient management
🐛 **Pest Control** - Identification, organic solutions, prevention strategies
🌤️ **Weather Advice** - Farm preparation, seasonal planning
💰 **Market Intelligence** - Price trends, selling strategies
🐄 **Livestock Care** - Health management, feeding, breeding
📊 **Farm Planning** - Budgeting, record keeping, optimization

Please ask me anything specific about farming, and I'll provide detailed, actionable advice tailored to your needs!

**Quick Tips:**
• Be specific about your crop type and location
• Mention any problems you're currently facing
• Ask about timing for seasonal activities

What would you like to know about today?`;
}

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

  const handleSend = async (content?: string) => {
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

    // Simulate AI response delay
    setTimeout(() => {
      const response = generateAIResponse(messageContent);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

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
              AI Powered
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
