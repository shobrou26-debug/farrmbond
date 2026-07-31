import { mutation } from "./_generated/server";

// ============================================================
// Marketplace Seed Data
// Run: bunx convex run seedData:seedMarketplace
// ============================================================

/** Seed all marketplace tables with realistic sample data */
export const seedMarketplace = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = {
      agronomists: 0,
      companies: 0,
      seeds: 0,
    };

    // Check if data already exists
    const existingAgronomists = await ctx.db
      .query("agronomistProfiles")
      .first();
    const existingCompanies = await ctx.db
      .query("agriculturalCompanies")
      .first();
    const existingSeeds = await ctx.db.query("seeds").first();

    if (existingAgronomists && existingCompanies && existingSeeds) {
      return { message: "Marketplace already seeded", ...results };
    }

    // Get the first user as a fallback for userId
    const anyUser = await ctx.db.query("users").first();
    if (!anyUser) {
      return { message: "No users found. Create a user first.", ...results };
    }

    // ============================================================
    // Seed Agronomist Profiles
    // ============================================================
    if (!existingAgronomists) {
      const agronomistData = [
        {
          userId: anyUser._id,
          title: "Crop Disease Specialist",
          specializations: ["Crop Management", "Pest Control", "Soil Science"],
          experience: 15,
          education: [
            { degree: "PhD Plant Pathology", institution: "University of Nairobi", year: 2010 },
          ],
          services: [
            { name: "Crop Disease Diagnosis", description: "Identify crop diseases and recommend treatment", price: 2500, duration: 30, type: "chat" as const },
            { name: "Field Visit", description: "On-farm inspection and diagnosis", price: 8000, duration: 120, type: "field_visit" as const },
          ],
          availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          availableHours: { start: "08:00", end: "17:00" },
          timezone: "Africa/Nairobi",
          averageRating: 4.9,
          totalReviews: 127,
          totalConsultations: 340,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: anyUser._id,
          title: "Livestock Veterinarian",
          specializations: ["Livestock Health", "Dairy Farming"],
          experience: 20,
          education: [
            { degree: "DVM", institution: "Egerton University", year: 2005 },
          ],
          services: [
            { name: "Livestock Health Consultation", description: "Expert advice on livestock health issues", price: 3000, duration: 45, type: "video" as const },
            { name: "Farm Visit", description: "Comprehensive livestock health assessment", price: 10000, duration: 180, type: "field_visit" as const },
          ],
          availableDays: ["monday", "wednesday", "friday", "saturday"],
          availableHours: { start: "09:00", end: "18:00" },
          timezone: "Africa/Nairobi",
          averageRating: 4.8,
          totalReviews: 89,
          totalConsultations: 215,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: anyUser._id,
          title: "Organic Farming Expert",
          specializations: ["Organic Farming", "Crop Management", "Irrigation"],
          experience: 10,
          education: [
            { degree: "MSc Sustainable Agriculture", institution: "Jomo Kenyatta University", year: 2015 },
          ],
          services: [
            { name: "Organic Transition Consultation", description: "Guide farmers transitioning to organic practices", price: 1500, duration: 30, type: "chat" as const },
          ],
          availableDays: ["tuesday", "thursday", "saturday"],
          availableHours: { start: "07:00", end: "16:00" },
          timezone: "Africa/Nairobi",
          averageRating: 4.7,
          totalReviews: 64,
          totalConsultations: 150,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: anyUser._id,
          title: "Soil & Fertility Expert",
          specializations: ["Soil Science", "Crop Management"],
          experience: 18,
          education: [
            { degree: "PhD Soil Science", institution: "Kenyatta University", year: 2008 },
          ],
          services: [
            { name: "Soil Analysis Consultation", description: "Interpret soil test results and recommend amendments", price: 3500, duration: 45, type: "video" as const },
            { name: "Farm Soil Assessment", description: "Comprehensive soil health evaluation", price: 12000, duration: 240, type: "field_visit" as const },
          ],
          availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          availableHours: { start: "08:00", end: "17:00" },
          timezone: "Africa/Nairobi",
          averageRating: 4.9,
          totalReviews: 156,
          totalConsultations: 420,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: anyUser._id,
          title: "Irrigation Specialist",
          specializations: ["Irrigation", "Crop Management"],
          experience: 12,
          education: [
            { degree: "BSc Agricultural Engineering", institution: "Dedan Kimathi University", year: 2013 },
          ],
          services: [
            { name: "Irrigation System Design", description: "Design efficient drip or sprinkler irrigation systems", price: 5000, duration: 60, type: "video" as const },
          ],
          availableDays: ["monday", "wednesday", "friday"],
          availableHours: { start: "09:00", end: "17:00" },
          timezone: "Africa/Nairobi",
          averageRating: 4.6,
          totalReviews: 42,
          totalConsultations: 95,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: anyUser._id,
          title: "Poultry & Piggery Expert",
          specializations: ["Poultry", "Livestock Health"],
          experience: 20,
          education: [
            { degree: "MSc Animal Science", institution: "University of Eldoret", year: 2006 },
          ],
          services: [
            { name: "Poultry Management Consultation", description: "Expert advice on poultry farm management", price: 2000, duration: 30, type: "chat" as const },
            { name: "Farm Assessment", description: "Complete poultry or piggery farm assessment", price: 7500, duration: 120, type: "field_visit" as const },
          ],
          availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
          availableHours: { start: "07:00", end: "18:00" },
          timezone: "Africa/Nairobi",
          averageRating: 4.8,
          totalReviews: 78,
          totalConsultations: 190,
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const profile of agronomistData) {
        await ctx.db.insert("agronomistProfiles", profile);
        results.agronomists++;
      }
    }

    // ============================================================
    // Seed Agricultural Companies
    // ============================================================
    if (!existingCompanies) {
      const companyData = [
        {
          name: "East African Seeds Co.",
          category: "seeds",
          description: "Leading seed producer in East Africa with certified hybrid seeds for maize, wheat, and vegetables. Over 30 years of research and development.",
          location: "Nairobi",
          country: "Kenya",
          phone: "+254 20 123 4567",
          email: "info@easeeds.co.ke",
          website: "https://easeeds.co.ke",
          products: ["Hybrid Maize Seeds", "Wheat Seeds", "Vegetable Seeds", "Bean Seeds"],
          rating: 4.8,
          reviewCount: 234,
          verified: true,
          featured: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "AgriGrow Fertilizers",
          category: "fertilizer",
          description: "Premium organic and synthetic fertilizers tailored for African soils. Custom formulations for different crop types.",
          location: "Kampala",
          country: "Uganda",
          phone: "+256 41 234 5678",
          email: "sales@agrigrow.ug",
          website: "https://agrigrow.ug",
          products: ["NPK Fertilizers", "Organic Compost", "Soil Amendments", "Foliar Feeds"],
          rating: 4.6,
          reviewCount: 156,
          verified: true,
          featured: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "FarmTech Equipment",
          category: "equipment",
          description: "Affordable farming equipment including mini tractors, ploughs, and harvesting machines designed for smallholder farmers.",
          location: "Dar es Salaam",
          country: "Tanzania",
          phone: "+255 22 345 6789",
          email: "info@farmtech.co.tz",
          website: "https://farmtech.co.tz",
          products: ["Mini Tractors", "Ploughs", "Threshers", "Seed Drills"],
          rating: 4.7,
          reviewCount: 89,
          verified: true,
          featured: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "GreenShield Crop Protection",
          category: "pesticides",
          description: "Eco-friendly pest control solutions safe for crops and the environment. Registered and approved for organic farming.",
          location: "Lagos",
          country: "Nigeria",
          phone: "+234 1 456 7890",
          email: "contact@greenshield.ng",
          website: "https://greenshield.ng",
          products: ["Organic Pesticides", "Herbicides", "Fungicides", "Insect Traps"],
          rating: 4.5,
          reviewCount: 112,
          verified: true,
          featured: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "AquaFlow Irrigation Systems",
          category: "irrigation",
          description: "Complete drip and sprinkler irrigation systems for all farm sizes. Solar-powered water pumps included.",
          location: "Addis Ababa",
          country: "Ethiopia",
          phone: "+251 11 234 5678",
          email: "info@aquaflow.et",
          website: "https://aquaflow.et",
          products: ["Drip Irrigation Kits", "Sprinkler Systems", "Solar Water Pumps", "Timers"],
          rating: 4.8,
          reviewCount: 67,
          verified: true,
          featured: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "LivestockPlus Supplies",
          category: "livestock",
          description: "Premium animal feeds, supplements, and veterinary supplies for dairy, poultry, and pig farmers across East Africa.",
          location: "Nairobi",
          country: "Kenya",
          phone: "+254 20 567 8901",
          email: "orders@livestockplus.co.ke",
          website: "https://livestockplus.co.ke",
          products: ["Dairy Feed", "Poultry Feed", "Mineral Supplements", "Dewormers"],
          rating: 4.7,
          reviewCount: 198,
          verified: true,
          featured: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "PrecisionAgri Services",
          category: "services",
          description: "Professional agricultural consulting, soil testing, drone surveying, and crop monitoring services.",
          location: "Kigali",
          country: "Rwanda",
          phone: "+250 788 123 456",
          email: "info@precisionagri.rw",
          website: "https://precisionagri.rw",
          products: ["Soil Testing", "Drone Surveys", "Crop Monitoring", "Farm Planning"],
          rating: 4.9,
          reviewCount: 45,
          verified: true,
          featured: true,
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const company of companyData) {
        await ctx.db.insert("agriculturalCompanies", company);
        results.companies++;
      }
    }

    // ============================================================
    // Seed Seeds
    // ============================================================
    if (!existingSeeds) {
      const seedData = [
        {
          name: "H614 Hybrid Maize",
          cropType: "Maize",
          variety: "H614",
          description: "High-yielding hybrid maize variety adapted for the Kenyan highlands. Excellent disease resistance and drought tolerance. Matures in 4-5 months.",
          company: "East African Seeds Co.",
          price: 450,
          currency: "KES",
          unit: "kg",
          germinationRate: 95,
          maturityDays: 120,
          yieldPerHectare: "35-40 bags/ha",
          waterNeeds: "Medium",
          climate: ["Tropical Highland", "Sub-humid"],
          season: ["Long Rains", "Short Rains"],
          inStock: true,
          featured: true,
          tags: ["Hybrid", "Drought Tolerant", "High Yield", "MLN Resistant"],
          rating: 4.8,
          reviewCount: 234,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "KAT/B-90 Coffee Variety",
          cropType: "Coffee",
          variety: "KAT/B-90",
          description: "High-quality Arabica coffee variety with excellent cup quality and disease resistance. Ideal for Kenyan highlands between 1500-2000m altitude.",
          company: "Kenya Agricultural Board",
          price: 800,
          currency: "KES",
          unit: "kg",
          germinationRate: 88,
          maturityDays: 365,
          yieldPerHectare: "2-3 tons/ha",
          waterNeeds: "Medium",
          climate: ["Tropical Highland"],
          season: ["Year-round planting"],
          inStock: true,
          featured: false,
          tags: ["Arabica", "Export Quality", "Disease Resistant"],
          rating: 4.7,
          reviewCount: 89,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "K84/1 Sorghum",
          cropType: "Sorghum",
          variety: "K84/1",
          description: "Drought-tolerant sorghum variety perfect for dryland farming. High nutritional value and excellent grain quality.",
          company: "KARI Seeds",
          price: 300,
          currency: "KES",
          unit: "kg",
          germinationRate: 92,
          maturityDays: 100,
          yieldPerHectare: "12-15 bags/ha",
          waterNeeds: "Low",
          climate: ["Semi-Arid", "Arid"],
          season: ["Long Rains"],
          inStock: true,
          featured: false,
          tags: ["Drought Tolerant", "Striga Resistant", "Food Security"],
          rating: 4.5,
          reviewCount: 67,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "Superior Dark Red Rosso Beans",
          cropType: "Beans",
          variety: "DRR",
          description: "Popular climbing bean variety with high protein content. Nitrogen-fixing properties improve soil health.",
          company: "KALRO Seeds",
          price: 350,
          currency: "KES",
          unit: "kg",
          germinationRate: 90,
          maturityDays: 80,
          yieldPerHectare: "10-12 bags/ha",
          waterNeeds: "Low",
          climate: ["Tropical Highland", "Sub-humid"],
          season: ["Long Rains", "Short Rains"],
          inStock: true,
          featured: true,
          tags: ["Climbing", "High Protein", "Nitrogen Fixing"],
          rating: 4.7,
          reviewCount: 145,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "Sugar Ann Peas",
          cropType: "Peas",
          variety: "Sugar Ann",
          description: "Sweet snap pea variety ideal for both fresh market and export. Quick maturing with excellent pod quality.",
          company: "Valley Seeds Ltd",
          price: 600,
          currency: "KES",
          unit: "kg",
          germinationRate: 91,
          maturityDays: 60,
          yieldPerHectare: "4-6 tons/ha",
          waterNeeds: "Medium",
          climate: ["Temperate", "Highland"],
          season: ["Long Rains", "Short Rains"],
          inStock: true,
          featured: false,
          tags: ["Snap Pea", "Export Quality", "Quick Maturing"],
          rating: 4.9,
          reviewCount: 52,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "Hass Avocado Grafts",
          cropType: "Avocado",
          variety: "Hass",
          description: "Premium Hass avocado grafted seedlings ready for planting. Export quality fruit with excellent shelf life.",
          company: "Greenlife Nurseries",
          price: 350,
          currency: "KES",
          unit: "seedling",
          germinationRate: 85,
          maturityDays: 730,
          yieldPerHectare: "10-15 tons/ha",
          waterNeeds: "Medium",
          climate: ["Tropical Highland"],
          season: ["Year-round planting"],
          inStock: true,
          featured: true,
          tags: ["Grafted", "Export Quality", "High Value"],
          rating: 4.8,
          reviewCount: 98,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "TDH-9512 Cassava",
          cropType: "Cassava",
          variety: "TDH-9512",
          description: "High-yielding cassava variety resistant to CMD and CBSD. Excellent for food security and industrial processing.",
          company: "National Horticultural Research Centre",
          price: 200,
          currency: "KES",
          unit: "cutting",
          germinationRate: 80,
          maturityDays: 300,
          yieldPerHectare: "15-20 tons/ha",
          waterNeeds: "Low",
          climate: ["Tropical", "Sub-humid"],
          season: ["Year-round planting"],
          inStock: true,
          featured: false,
          tags: ["CMD Resistant", "CBSD Resistant", "Food Security"],
          rating: 4.6,
          reviewCount: 78,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: "Njoro Red Tea Clone",
          cropType: "Tea",
          variety: "Njoro Red",
          description: "Premium black tea clone adapted for Kenyan highlands. Excellent yield potential and superior quality for export markets.",
          company: "KTDA Nurseries",
          price: 150,
          currency: "KES",
          unit: "seedling",
          germinationRate: 88,
          maturityDays: 1095,
          yieldPerHectare: "3,000-4,000 kg/ha",
          waterNeeds: "High",
          climate: ["Tropical Highland", "Humid"],
          season: ["Year-round planting"],
          inStock: true,
          featured: false,
          tags: ["Black Tea", "Export Quality", "KTDA Certified"],
          rating: 4.7,
          reviewCount: 56,
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const seed of seedData) {
        await ctx.db.insert("seeds", seed);
        results.seeds++;
      }
    }

    return {
      message: "Marketplace seeded successfully!",
      ...results,
    };
  },
});

/** Clear all marketplace data (admin only) */
export const clearMarketplace = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all agronomist profiles
    const agronomists = await ctx.db.query("agronomistProfiles").collect();
    for (const a of agronomists) {
      await ctx.db.delete(a._id);
    }

    // Delete all companies
    const companies = await ctx.db.query("agriculturalCompanies").collect();
    for (const c of companies) {
      await ctx.db.delete(c._id);
    }

    // Delete all seeds
    const seeds = await ctx.db.query("seeds").collect();
    for (const s of seeds) {
      await ctx.db.delete(s._id);
    }

    return {
      message: "Marketplace data cleared",
      deleted: {
        agronomists: agronomists.length,
        companies: companies.length,
        seeds: seeds.length,
      },
    };
  },
});

// ============================================================
// Knowledge Articles Seed Data
// ============================================================

/** Seed knowledge articles with agronomy best practices */
export const seedKnowledgeArticles = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const anyUser = await ctx.db.query("users").first();
    if (!anyUser) return { message: "No users found", count: 0 };
    const existing = await ctx.db.query("knowledgeArticles").first();
    if (existing) return { message: "Already seeded", count: 0 };
    const articles = [
      { title: "Maize Planting Guide", summary: "Comprehensive guide to growing maize in tropical African climates.", content: "Seed Selection: Choose certified hybrid seeds. Soil Preparation: Plough to 20-30cm depth, apply manure. Planting: 75cm rows, 25cm plants, 5-8cm deep. Management: Weed at 2-3 and 5-6 weeks, top-dress with CAN. Harvest when husks turn brown.", category: "Crop Management", tags: ["Maize", "Cereals", "Planting"], views: 2450, likes: 189, bookmarks: 67, isPublished: true, isFeatured: true },
      { title: "Integrated Pest Management", summary: "Manage pests using biological, cultural, and chemical methods.", content: "Biological Control: Encourage natural predators, use Bt for caterpillars. Cultural: Crop rotation, intercropping, resistant varieties. Physical: Hand-picking, pheromone traps, sticky traps. Chemical: Last resort, follow economic thresholds.", category: "Pest Management", tags: ["IPM", "Pests", "Biological Control"], views: 1890, likes: 156, bookmarks: 89, isPublished: true, isFeatured: true },
      { title: "Soil Health Management", summary: "Understanding soil composition, testing, and amendment strategies.", content: "Test annually for pH, N, P, K. Optimal pH 6.0-7.0. Build organic matter with compost at 5-10 tonnes/ha. Use cover crops. Apply lime for acidic soils. Practice conservation agriculture.", category: "Soil Management", tags: ["Soil Health", "pH", "Organic Matter"], views: 2100, likes: 203, bookmarks: 112, isPublished: true, isFeatured: true },
      { title: "Drip Irrigation Guide", summary: "Design, install, and maintain drip irrigation systems.", content: "40-60% water savings. Components: water source, filtration, main line, drip tape. Maintenance: flush monthly, clean filters weekly. ROI within 1-2 seasons for high-value crops.", category: "Irrigation", tags: ["Drip Irrigation", "Water Management"], views: 1650, likes: 134, bookmarks: 78, isPublished: true, isFeatured: false },
      { title: "Climate-Smart Agriculture", summary: "Adapt to changing weather patterns with resilient practices.", content: "Plant drought-tolerant varieties. Use mulching and rainwater harvesting. Practice conservation agriculture. Diversify crops. Increase soil organic matter for water retention.", category: "Climate & Weather", tags: ["Climate Change", "Adaptation", "Resilience"], views: 1780, likes: 167, bookmarks: 95, isPublished: true, isFeatured: false },
      { title: "Post-Harvest Loss Reduction", summary: "Minimize losses in cereals through proper drying and storage.", content: "Dry grains to 13-14% moisture. Use hermetic bags (PICS, GrainPro). Metal silos for bulk storage. Reducing losses by 10% increases income by 20-30%.", category: "Post-Harvest", tags: ["Post-Harvest", "Storage", "Cereals"], views: 1520, likes: 142, bookmarks: 88, isPublished: true, isFeatured: false },
      { title: "Organic Farming Transition", summary: "Step-by-step guide to transitioning to organic farming.", content: "3-year transition period. Use compost, green manures, biological fertilizers. Crop rotation minimum 3 years. Certification required. Premium prices 20-100% higher.", category: "Organic Farming", tags: ["Organic", "Certification", "Sustainable"], views: 1920, likes: 178, bookmarks: 102, isPublished: true, isFeatured: true },
      { title: "Dairy Cattle Nutrition", summary: "Formulate balanced rations for dairy cattle.", content: "16-18% crude protein needed. Forage:Concentrate 60:40. Local feeds: Napier grass, maize silage, legume hays. Feed twice daily. Clean water ad libitum.", category: "Livestock Management", tags: ["Dairy", "Feed", "Nutrition"], views: 1680, likes: 145, bookmarks: 76, isPublished: true, isFeatured: false },
      { title: "Farm Financial Management", summary: "Essential bookkeeping for farm profitability.", content: "Track income and expenses by enterprise. Use cash book system. Calculate gross margins. Break-even analysis. Mobile apps available for record keeping.", category: "Farm Business", tags: ["Finance", "Records", "Profitability"], views: 1340, likes: 118, bookmarks: 92, isPublished: true, isFeatured: false },
      { title: "Agroforestry Systems", summary: "Integrate trees with crops and livestock for sustainability.", content: "Alley cropping with Gliricidia, Leucaena. Silvopasture with Grevillea. Boundary planting with Moringa. Improves soil fertility, diversifies income, sequesters carbon.", category: "Agroforestry", tags: ["Trees", "Sustainable", "Biodiversity"], views: 1450, likes: 132, bookmarks: 71, isPublished: true, isFeatured: false },
    ];
    let count = 0;
    for (const article of articles) {
      await ctx.db.insert("knowledgeArticles", {
        authorId: anyUser._id,
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
        tags: article.tags,
        views: article.views,
        likes: article.likes,
        bookmarks: article.bookmarks,
        isPublished: article.isPublished,
        isFeatured: article.isFeatured,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      });
      count++;
    }
    return { message: `Seeded ${count} knowledge articles`, count };
  },
});
