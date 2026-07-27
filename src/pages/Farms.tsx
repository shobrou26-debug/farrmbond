import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Map,
  Plus,
  Search,
  Leaf,
  Beef,
  Droplets,
  TrendingUp,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Satellite,
  Sprout,
  Navigation,
  Ruler,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const mockFarms = [
  {
    id: "1",
    name: "Green Valley Farm",
    location: "Nairobi, Kenya",
    size: 45,
    sizeUnit: "acres",
    status: "active",
    crops: 4,
    livestock: 12,
    healthScore: 92,
    ndvi: 78,
    coverImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400",
  },
  {
    id: "2",
    name: "Sunrise Ranch",
    location: "Nakuru, Kenya",
    size: 120,
    sizeUnit: "acres",
    status: "active",
    crops: 6,
    livestock: 36,
    healthScore: 78,
    ndvi: 65,
    coverImage: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400",
  },
  {
    id: "3",
    name: "Riverside Fields",
    location: "Kisumu, Kenya",
    size: 30,
    sizeUnit: "acres",
    status: "planting",
    crops: 2,
    livestock: 0,
    healthScore: 85,
    ndvi: 82,
    coverImage: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400",
  },
];

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  inactive: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  harvesting: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  planting: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export default function Farms() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFarms = mockFarms.filter((farm) =>
    farm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Farms</h1>
              <p className="text-muted-foreground mt-1">Manage and monitor all your farms</p>
            </div>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Register New Farm
            </Button>
          </div>
        </motion.div>

        {/* Search & Filters */}
        <motion.div variants={itemVariants} initial="hidden" animate="visible" className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search farms..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Button variant="outline">
              <Map className="w-4 h-4 mr-2" />
              Map View
            </Button>
          </div>
        </motion.div>

        {/* Farm Grid */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredFarms.map((farm) => (
            <motion.div key={farm.id} variants={itemVariants}>
              <Card className="border-border/50 overflow-hidden card-hover group">
                {/* Cover Image */}
                <div className="relative h-48 overflow-hidden">
                  <img src={farm.coverImage} alt={farm.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute top-3 right-3">
                    <Badge className={statusColors[farm.status]}>{farm.status}</Badge>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-lg font-bold text-white">{farm.name}</h3>
                    <div className="flex items-center gap-1 text-white/80 text-sm">
                      <Map className="w-3.5 h-3.5" />
                      {farm.location}
                    </div>
                  </div>
                  <div className="absolute top-3 left-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 bg-white/90 hover:bg-white">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                        <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit Farm</DropdownMenuItem>
                        <DropdownMenuItem><Satellite className="w-4 h-4 mr-2" />Satellite View</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <CardContent className="p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Ruler className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-bold">{farm.size}</p>
                      <p className="text-xs text-muted-foreground">{farm.sizeUnit}</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Sprout className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-bold">{farm.crops}</p>
                      <p className="text-xs text-muted-foreground">Crops</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Beef className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-sm font-bold">{farm.livestock}</p>
                      <p className="text-xs text-muted-foreground">Livestock</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Health Score</span>
                        <span className="font-medium">{farm.healthScore}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${farm.healthScore}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">NDVI Index</span>
                        <span className="font-medium">{farm.ndvi}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${farm.ndvi}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" className="flex-1" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button className="flex-1 gradient-primary" size="sm">
                      <Satellite className="w-4 h-4 mr-2" />
                      Satellite
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AppLayout>
  );
}
