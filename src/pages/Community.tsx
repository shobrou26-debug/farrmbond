import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/convex/_generated/api";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare,
  Heart,
  MessageCircle,
  Share2,
  Search,
  TrendingUp,
  Users,
  FileText,
  Sprout,
  Send,
  Trash2,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type Post = {
  _id: string;
  title: string;
  content: string;
  category: string;
  tags?: string[];
  likes: number;
  comments: number;
  shares: number;
  authorName: string;
  authorRole: string;
  authorImage?: string;
  likedByMe: boolean;
  createdAt: number;
};

const categories = [
  { label: "All Posts", value: "all", icon: MessageSquare },
  { label: "Crop Health", value: "crop_health", icon: Sprout },
  { label: "Market", value: "market", icon: TrendingUp },
  { label: "Tips", value: "tips", icon: FileText },
  { label: "Questions", value: "questions", icon: MessageCircle },
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function Community() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("all");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const createPost = useMutation(api.community.createPost);
  const likePost = useMutation(api.community.likePost);
  const addComment = useMutation(api.community.addComment);
  const deletePost = useMutation(api.community.deletePost);
  const incrementShareCount = useMutation(api.community.incrementShareCount);

  const { results: posts, isLoading, loadMore, canLoadMore, sentinelRef } =
    usePaginatedQuery<Post>(api.community.listPosts, {
      category: activeCategory === "all" ? undefined : activeCategory,
    });

  const comments = useQuery(api.community.listComments, {
    postId: expandedPost as any,
  });

  const [commentText, setCommentText] = useState<Record<string, string>>({});

  const filteredPosts = useMemo(
    () =>
      searchQuery
        ? posts.filter(
            (p) =>
              p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : posts,
    [posts, searchQuery]
  );

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((p) =>
      (p.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1))
    );
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [posts]);

  const handlePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Please add a title and content");
      return;
    }
    try {
      await createPost({
        title: newTitle,
        content: newContent,
        category: newCategory,
        tags: newContent.split(/\s+/).filter((w) => w.startsWith("#")).map((w) => w.slice(1)).slice(0, 5),
      });
      toast.success("Post published");
      setNewTitle("");
      setNewContent("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    }
  };

  const handleLike = async (post: Post) => {
    try {
      await likePost({ postId: post._id as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to like");
    }
  };

  const handleShare = async (post: Post) => {
    const shareData = { title: post.title, text: post.content.slice(0, 200), url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${post.title} — ${window.location.href}`);
        toast.success("Link copied to clipboard");
      }
      incrementShareCount({ postId: post._id as any });
    } catch {
      // user cancelled share dialog — ignore
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentText[postId] || "").trim();
    if (!text) return;
    try {
      await addComment({ postId: postId as any, content: text });
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
      toast.success("Comment added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to comment");
    }
  };

  const handleDeletePost = async (post: Post) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deletePost({ postId: post._id as any });
      toast.success("Post deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete post");
    }
  };

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
                      <button
                        key={cat.value}
                        onClick={() => setActiveCategory(cat.value)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          activeCategory === cat.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
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
                {trendingTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tags appear as posts are published</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {trendingTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => setSearchQuery(tag)}
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Join the conversation</p>
                  <p className="text-xs text-muted-foreground">Share what's working on your farm</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="lg:col-span-3 space-y-4">
            {/* Search */}
            <motion.div variants={itemVariants}>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search posts or tags..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </motion.div>

            {/* New Post */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user?.image || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary">{user?.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Input placeholder="Post title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                      <Textarea placeholder="Share with the farming community..." className="min-h-[80px] resize-none" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="text-sm rounded-lg border border-border bg-background px-3 py-1.5"
                        >
                          <option value="general">General</option>
                          <option value="crop_health">Crop Health</option>
                          <option value="market">Market</option>
                          <option value="tips">Tips</option>
                          <option value="questions">Questions</option>
                        </select>
                        <Button size="sm" className="gradient-primary" disabled={!newTitle.trim() || !newContent.trim()} onClick={handlePost}>
                          <Send className="w-4 h-4 mr-1" />Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Posts */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 bg-muted/40 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">No posts yet</h3>
                <p className="text-muted-foreground mt-1">Be the first to start a discussion in this category</p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <motion.div key={post._id} variants={itemVariants}>
                  <Card className="border-border/50 card-hover">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={post.authorImage || ""} />
                          <AvatarFallback className="bg-primary/10 text-primary">{post.authorName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{post.authorName}</p>
                            <Badge variant="secondary" className="text-xs">{post.authorRole}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
                        </div>
                        {post.authorName === (user?.name || "Farmer") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => handleDeletePost(post)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <h3 className="text-base font-semibold mb-2">{post.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{post.content}</p>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {post.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">#{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 pt-3 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`${post.likedByMe ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
                          onClick={() => handleLike(post)}
                        >
                          <Heart className={`w-4 h-4 mr-1 ${post.likedByMe ? "fill-current" : ""}`} />
                          {post.likes}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => setExpandedPost(expandedPost === post._id ? null : post._id)}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          {post.comments}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleShare(post)}>
                          <Share2 className="w-4 h-4 mr-1" />Share
                        </Button>
                      </div>

                      {/* Comments */}
                      {expandedPost === post._id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border/50 space-y-3">
                          {(comments ?? []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No comments yet</p>
                          ) : (
                            (comments ?? []).map((comment: any) => (
                              <div key={comment._id} className="flex items-start gap-2">
                                <Avatar className="w-7 h-7">
                                  <AvatarImage src={comment.authorImage || ""} />
                                  <AvatarFallback className="bg-muted text-xs">{comment.authorName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 rounded-xl bg-muted/40 p-3">
                                  <p className="text-xs font-medium">{comment.authorName}</p>
                                  <p className="text-sm mt-0.5">{comment.content}</p>
                                </div>
                              </div>
                            ))
                          )}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Write a comment..."
                              value={commentText[post._id] || ""}
                              onChange={(e) => setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))}
                            />
                            <Button size="sm" className="gradient-primary" onClick={() => handleAddComment(post._id)}>Send</Button>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}

            {canLoadMore && (
              <div ref={sentinelRef} className="h-10 flex items-center justify-center">
                <Button variant="ghost" size="sm" onClick={loadMore}>Load more posts</Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
