import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
import {
  Search,
  BookOpen,
  Clock,
  User,
  Tag,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Share2,
  Printer,
  Copy,
  Check,
  Twitter,
  MessageCircle,
  Leaf,
  Bug,
  Droplets,
  Sun,
  Tractor,
  Wheat,
  Apple,
  TreePine,
  GraduationCap,
  BarChart3,
  Filter,
  Grid3X3,
  List,
  Star,
  Eye,
  Heart,
  ArrowRight,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ============================================================
// Types
// ============================================================
interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  categoryIcon: React.ReactNode;
  author: string;
  publishDate: string;
  readTime: number;
  tags: string[];
  views: number;
  likes: number;
  featured: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  count: number;
  color: string;
}

// ============================================================
// Category Icon Map
// ============================================================
const categoryIconMap: Record<string, React.ReactNode> = {
  "Soil Management": <Leaf className="w-5 h-5" />,
  "Pest Management": <Bug className="w-5 h-5" />,
  "Irrigation": <Droplets className="w-5 h-5" />,
  "Climate & Weather": <Sun className="w-5 h-5" />,
  "Farm Equipment": <Tractor className="w-5 h-5" />,
  "Crop Nutrition": <Wheat className="w-5 h-5" />,
  "Post-Harvest": <Apple className="w-5 h-5" />,
  "Agroforestry": <TreePine className="w-5 h-5" />,
  "Marketing": <BarChart3 className="w-5 h-5" />,
  "Organic Farming": <Leaf className="w-5 h-5" />,
  "Crop Management": <Wheat className="w-5 h-5" />,
  "Livestock Management": <Tractor className="w-5 h-5" />,
  "Farm Business": <BarChart3 className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  "Soil Management": "from-amber-600 to-orange-700",
  "Pest Management": "from-red-500 to-rose-600",
  "Irrigation": "from-blue-500 to-cyan-600",
  "Climate & Weather": "from-yellow-500 to-amber-600",
  "Farm Equipment": "from-gray-500 to-slate-600",
  "Crop Nutrition": "from-green-600 to-emerald-700",
  "Post-Harvest": "from-pink-500 to-rose-600",
  "Agroforestry": "from-emerald-600 to-green-700",
  "Marketing": "from-indigo-500 to-purple-600",
  "Organic Farming": "from-lime-500 to-green-600",
  "Crop Management": "from-green-500 to-emerald-600",
  "Livestock Management": "from-orange-500 to-amber-600",
  "Farm Business": "from-indigo-500 to-blue-600",
};

// ============================================================
// Helper Functions
// ============================================================
const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatNumber = (num: number) => {
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
};

const getDifficultyColor = (diff: string) => {
  switch (diff) {
    case "beginner":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "intermediate":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "advanced":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

// ============================================================
// Animation Variants
// ============================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============================================================
// Main Component
// ============================================================
export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  // Real-time Convex mutations
  const toggleBookmarkMutation = useMutation(api.knowledgeArticles.toggleBookmark);
  const toggleLikeMutation = useMutation(api.knowledgeArticles.toggleLike);
  const incrementViewsMutation = useMutation(api.knowledgeArticles.incrementViews);

  // Fetch user bookmarks from Convex
  const userBookmarkIds = useQuery(api.knowledgeArticles.getUserBookmarks);
  const bookmarkSet = useMemo(() => new Set(userBookmarkIds ?? []), [userBookmarkIds]);

  // Fetch articles from Convex
  const rawArticles = useQuery(api.knowledgeArticles.listPublished, {
    category: selectedCategory === "all" ? undefined : selectedCategory,
  });

  const isLoading = rawArticles === undefined;

  // Map Convex data to Article interface
  const articles: Article[] = useMemo(() => {
    if (!rawArticles) return [];
    return rawArticles.map((a) => ({
      id: a._id as string,
      title: a.title,
      summary: a.summary,
      content: a.content,
      category: a.category,
      categoryIcon: categoryIconMap[a.category] || <BookOpen className="w-5 h-5" />,
      author: "FarmBond Expert Team",
      publishDate: a.publishedAt ? formatDate(a.publishedAt) : formatDate(a.createdAt),
      readTime: Math.max(3, Math.ceil(a.content.split(" ").length / 200)),
      tags: a.tags || [],
      views: a.views,
      likes: a.likes,
      featured: a.isFeatured,
      difficulty: "intermediate",
    }));
  }, [rawArticles]);

  // Filter articles
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch =
        searchQuery === "" ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;
      const matchesDifficulty =
        difficultyFilter === "all" || article.difficulty === difficultyFilter;
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [articles, searchQuery, selectedCategory, difficultyFilter]);

  // Featured articles
  const featuredArticles = articles.filter((a) => a.featured);

  // Build categories with counts
  const categories: Category[] = useMemo(() => {
    const allCats = [
      { id: "all", name: "All Topics", icon: <BookOpen className="w-5 h-5" />, color: "from-emerald-500 to-teal-600" },
      { id: "Soil Management", name: "Soil Management", icon: <Leaf className="w-5 h-5" />, color: "from-amber-600 to-orange-700" },
      { id: "Pest Management", name: "Pest Management", icon: <Bug className="w-5 h-5" />, color: "from-red-500 to-rose-600" },
      { id: "Irrigation", name: "Irrigation", icon: <Droplets className="w-5 h-5" />, color: "from-blue-500 to-cyan-600" },
      { id: "Climate & Weather", name: "Climate & Weather", icon: <Sun className="w-5 h-5" />, color: "from-yellow-500 to-amber-600" },
      { id: "Farm Equipment", name: "Farm Equipment", icon: <Tractor className="w-5 h-5" />, color: "from-gray-500 to-slate-600" },
      { id: "Crop Nutrition", name: "Crop Nutrition", icon: <Wheat className="w-5 h-5" />, color: "from-green-600 to-emerald-700" },
      { id: "Post-Harvest", name: "Post-Harvest", icon: <Apple className="w-5 h-5" />, color: "from-pink-500 to-rose-600" },
      { id: "Agroforestry", name: "Agroforestry", icon: <TreePine className="w-5 h-5" />, color: "from-emerald-600 to-green-700" },
      { id: "Marketing", name: "Marketing", icon: <BarChart3 className="w-5 h-5" />, color: "from-indigo-500 to-purple-600" },
      { id: "Organic Farming", name: "Organic Farming", icon: <Leaf className="w-5 h-5" />, color: "from-lime-500 to-green-600" },
      { id: "Crop Management", name: "Crop Management", icon: <Wheat className="w-5 h-5" />, color: "from-green-500 to-emerald-600" },
      { id: "Livestock Management", name: "Livestock", icon: <Tractor className="w-5 h-5" />, color: "from-orange-500 to-amber-600" },
      { id: "Farm Business", name: "Farm Business", icon: <BarChart3 className="w-5 h-5" />, color: "from-indigo-500 to-blue-600" },
    ];
    return allCats.map((cat) => ({
      ...cat,
      count: cat.id === "all" ? articles.length : articles.filter((a) => a.category === cat.id).length,
    })).filter((cat) => cat.id === "all" || cat.count > 0);
  }, [articles]);

  // Toggle bookmark via Convex
  const handleToggleBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await toggleBookmarkMutation({ articleId: id as Id<"knowledgeArticles"> });
      setBookmarked((prev) => {
        const next = new Set(prev);
        if (result.bookmarked) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (err) {
      console.error("Bookmark error:", err);
    }
  };

  // Like article via Convex
  const handleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked.has(id)) return; // Already liked
    try {
      await toggleLikeMutation({ articleId: id as Id<"knowledgeArticles"> });
      setLiked((prev) => new Set(prev).add(id));
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  // Track article view via Convex
  const handleViewArticle = async (article: Article) => {
    setSelectedArticle(article);
    try {
      await incrementViewsMutation({ articleId: article.id as Id<"knowledgeArticles"> });
    } catch (err) {
      // Silently fail view tracking
    }
  };

  // Render article content with markdown-like formatting
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-xl font-bold text-foreground mt-8 mb-4">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={i} className="text-lg font-semibold text-foreground mt-6 mb-3">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("- ")) {
        return <li key={i} className="ml-4 mb-1 text-muted-foreground list-disc">{line.replace("- ", "")}</li>;
      }
      if (line.match(/^\d+\./)) {
        return <li key={i} className="ml-4 mb-1 text-muted-foreground list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
      }
      if (line.trim() === "") return <br key={i} />;
      return <p key={i} className="mb-2 text-muted-foreground leading-relaxed">{line}</p>;
    });
  };

  // Article Detail View
  if (selectedArticle) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button onClick={() => setSelectedArticle(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ChevronLeft className="w-5 h-5" /> Back to Knowledge Base
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">{selectedArticle.category}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(selectedArticle.difficulty)}`}>
                {selectedArticle.difficulty.charAt(0).toUpperCase() + selectedArticle.difficulty.slice(1)}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{selectedArticle.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-2"><User className="w-4 h-4" />{selectedArticle.author}</span>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{selectedArticle.readTime} min read</span>
              <span className="flex items-center gap-2"><Eye className="w-4 h-4" />{formatNumber(selectedArticle.views)} views</span>
              <span>{selectedArticle.publishDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={(e) => handleToggleBookmark(selectedArticle.id, e)} className={`p-2 rounded-lg border transition-colors ${bookmarked.has(selectedArticle.id) || bookmarkSet.has(selectedArticle.id as Id<"knowledgeArticles">) ? "bg-primary/10 border-primary/30 text-primary" : "border-border hover:bg-muted"}`}>
                <Bookmark className="w-5 h-5" />
              </button>
              <div className="relative">
                <button onClick={() => setShowShareMenu(!showShareMenu)} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"><Share2 className="w-5 h-5" /></button>
                {showShareMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-lg z-50 p-2">
                      <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); setShowShareMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? "Copied!" : "Copy Link"}
                      </button>
                      <button onClick={() => { if (navigator.share) { navigator.share({ title: selectedArticle.title, text: selectedArticle.summary, url: window.location.href }); } setShowShareMenu(false); }} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors">
                        <Share2 className="w-4 h-4" /> Share via Device
                      </button>
                      <div className="border-t border-border my-1" />
                      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(selectedArticle.title)}&url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" onClick={() => setShowShareMenu(false)} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors">
                        <Twitter className="w-4 h-4" /> Twitter
                      </a>
                      <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(selectedArticle.title + " " + window.location.href)}`} target="_blank" rel="noopener noreferrer" onClick={() => setShowShareMenu(false)} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors">
                        <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
                      </a>
                      <a href={`mailto:?subject=${encodeURIComponent(selectedArticle.title)}&body=${encodeURIComponent(selectedArticle.summary + "\n\n" + window.location.href)}`} onClick={() => setShowShareMenu(false)} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors">
                        <MessageCircle className="w-4 h-4 text-blue-600" /> Email
                      </a>
                    </div>
                  </>
                )}
              </div>
              <button className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"><Printer className="w-5 h-5" /></button>
            </div>
          </motion.div>

          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="prose prose-lg max-w-none">
            {renderContent(selectedArticle.content)}
          </motion.article>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {selectedArticle.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-muted text-sm text-muted-foreground">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Main Knowledge Base View
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Knowledge Base</h1>
          </div>
          <p className="text-muted-foreground ml-14">Expert agronomy articles and best practices to improve your farming</p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search articles, topics, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
              <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-border/50">
                <Skeleton className="h-48 w-full rounded-t-xl" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Featured Articles */}
        {!isLoading && selectedCategory === "all" && !searchQuery && featuredArticles.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" /> Featured Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredArticles.map((article) => (
                <motion.div key={article.id} whileHover={{ y: -4, scale: 1.02 }} onClick={() => handleViewArticle(article)} className="cursor-pointer rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all">
                  <div className="p-3">
                    <Badge className="mb-2 text-xs" variant="secondary">{article.category}</Badge>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">{article.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" /> {article.readTime} min
                      <span className="text-muted-foreground/50">•</span> {article.category}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Categories */}
        {!isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" /> Categories
            </h2>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-card border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  {cat.icon}
                  <span className="font-medium text-sm">{cat.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory === cat.id ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Results Count */}
        {!isLoading && (
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {filteredArticles.length} of {articles.length} articles
          </div>
        )}

        {/* Articles Grid/List */}
        {!isLoading && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
            {filteredArticles.map((article) => (
              <motion.div
                key={article.id}
                variants={itemVariants}
                whileHover={{ y: viewMode === "grid" ? -4 : 0 }}
                onClick={() => handleViewArticle(article)}
                className={`cursor-pointer bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all ${viewMode === "list" ? "flex" : ""}`}
              >
                <div className="p-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      {article.categoryIcon} {article.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(article.difficulty)}`}>
                      {article.difficulty}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{article.summary}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTime}m</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(article.views)}</span>
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(article.likes)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {article.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">{tag}</span>
                    ))}
                    {article.tags.length > 3 && <span className="text-xs text-muted-foreground">+{article.tags.length - 3}</span>}
                  </div>
                </div>
                <div className={`flex items-center justify-center ${viewMode === "list" ? "px-4" : "px-4 pb-4"}`}>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary">Read <ArrowRight className="w-4 h-4" /></div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && filteredArticles.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No articles found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
            <button onClick={() => { setSearchQuery(""); setSelectedCategory("all"); setDifficultyFilter("all"); }} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Clear Filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
