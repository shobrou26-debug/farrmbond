import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare,
  Plus,
  Heart,
  MessageCircle,
  Share2,
  Image,
  Search,
  TrendingUp,
  Users,
  FileText,
  Bookmark,
  Send,
  Sprout,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const mockPosts = [
  {
    id: "1",
    author: "Grace Wanjiku",
    avatar: "",
    role: "Farmer",
    title: "Success with Drip Irrigation in Semi-Arid Areas",
    content: "After installing drip irrigation, my water usage dropped by 60% and tomato yield increased by 40%. Happy to share my setup details with anyone interested. The key is maintaining proper pressure and regular filter cleaning.",
    category: "tips",
    likes: 47,
    comments: 12,
    time: "3 hours ago",
    tags: ["irrigation", "tomatoes", "water-management"],
  },
  {
    id: "2",
    author: "Dr. James Ochieng",
    avatar: "",
    role: "Agronomist",
    title: "New Maize Disease Alert - Fall Armyworm",
    content: "I've been seeing increased Fall Armyworm activity in Western Kenya. Early detection is crucial. Look for window-pane feeding on leaves and frass near the whorl. Contact your county agricultural officer immediately if suspected.",
    category: "crop_health",
    likes: 89,
    comments: 34,
    time: "6 hours ago",
    tags: ["maize", "pest-alert", "armyworm"],
  },
  {
    id: "3",
    author: "Peter Mwangi",
    avatar: "",
    role: "Farmer",
    title: "Market Prices This Week - Good Time to Sell!",
    content: "Maize prices at NAFARM are currently at KES 4,100/bag, up 8% from last week. Bean prices also trending up. If you have stored stock, now might be a good time to consider selling.",
    category: "market",
    likes: 32,
    comments: 8,
    time: "1 day ago",
    tags: ["market-prices", "maize", "beans"],
  },
];

const categories = [
  { label: "All Posts", value: "all", icon: MessageSquare },
  { label: "Crop Health", value: "crop_health", icon: Sprout },
  { label: "Market", value: "market", icon: TrendingUp },
  { label: "Tips", value: "tips", icon: FileText },
  { label: "Questions", value: "questions", icon: MessageCircle },
];

export default function Community() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [newPost, setNewPost] = useState("");

  const filtered = activeCategory === "all"
    ? mockPosts
    : mockPosts.filter((p) => p.category === activeCategory);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Community</h1>
          <p className="text-muted-foreground mt-1">Connect with farmers and agricultural experts</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <motion.div variants={itemVariants} initial="hidden" animate="visible" className="lg:col-span-1 space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <nav className="space-y-1">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button key={cat.value} onClick={() => setActiveCategory(cat.value)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeCategory === cat.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                        <Icon className="w-4 h-4" />
                        {cat.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Trending Tags</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {["maize", "irrigation", "organic", "livestock", "climate", "market"].map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-primary/10">#{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="lg:col-span-3 space-y-4">
            {/* New Post */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10"><AvatarFallback className="bg-primary/10 text-primary">U</AvatarFallback></Avatar>
                    <div className="flex-1 space-y-3">
                      <Textarea placeholder="Share with the farming community..." className="min-h-[80px] resize-none" value={newPost} onChange={(e) => setNewPost(e.target.value)} />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm"><Image className="w-4 h-4 mr-1" />Photo</Button>
                        </div>
                        <Button size="sm" className="gradient-primary" disabled={!newPost.trim()}>
                          <Send className="w-4 h-4 mr-1" />Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Posts */}
            {filtered.map((post) => (
              <motion.div key={post.id} variants={itemVariants}>
                <Card className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className="w-10 h-10"><AvatarFallback className="bg-primary/10 text-primary">{post.author.charAt(0)}</AvatarFallback></Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{post.author}</p>
                          <Badge variant="secondary" className="text-xs">{post.role}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{post.time}</p>
                      </div>
                    </div>
                    <h3 className="text-base font-semibold mb-2">{post.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{post.content}</p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 pt-3 border-t border-border/50">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500">
                        <Heart className="w-4 h-4 mr-1" />{post.likes}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <MessageCircle className="w-4 h-4 mr-1" />{post.comments}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Share2 className="w-4 h-4 mr-1" />Share
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground ml-auto">
                        <Bookmark className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
