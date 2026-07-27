import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  image: string;
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  count: number;
  color: string;
}

// ============================================================
// Article Database
// ============================================================
const articles: Article[] = [
  {
    id: "1",
    title: "Soil Health Management: The Foundation of Sustainable Farming",
    summary:
      "Learn how to assess, maintain, and improve soil health for optimal crop production and long-term farm sustainability.",
    content: `Soil health is the foundation of productive and sustainable agriculture. Healthy soil provides essential nutrients, water, and support for plant growth while harboring beneficial microorganisms that protect crops from diseases.

## Understanding Soil Health

Soil health encompasses the physical, chemical, and biological properties of soil. A healthy soil ecosystem supports:

- **Nutrient cycling** - Breaking down organic matter into plant-available nutrients
- **Water retention** - Holding moisture for plant use between rainfall or irrigation
- **Disease suppression** - Beneficial microbes that outcompete harmful pathogens
- **Carbon sequestration** - Storing carbon to mitigate climate change

## Key Practices for Soil Health

### 1. Minimize Tillage
Reducing or eliminating tillage preserves soil structure and protects beneficial organisms. Consider transitioning to no-till or reduced-till farming systems.

### 2. Cover Cropping
Plant cover crops during fallow periods to:
- Prevent soil erosion
- Add organic matter
- Fix nitrogen (legumes)
- Break pest cycles

### 3. Crop Rotation
Rotate crops annually to:
- Break pest and disease cycles
- Improve nutrient balance
- Enhance soil structure
- Reduce weed pressure

### 4. Organic Matter Addition
Apply compost, manure, or crop residues to:
- Feed soil microorganisms
- Improve water holding capacity
- Increase nutrient availability
- Enhance soil structure

## Soil Testing

Regular soil testing is essential for monitoring soil health. Test for:
- pH levels (ideal range: 6.0-7.0 for most crops)
- Organic matter content
- Macronutrients (N, P, K)
- Micronutrients (Ca, Mg, S, Fe, Mn, Zn, Cu)
- Cation Exchange Capacity (CEC)

## Conclusion

Investing in soil health pays dividends through improved yields, reduced input costs, and long-term farm sustainability.`,
    category: "Soil Management",
    categoryIcon: <Leaf className="w-5 h-5" />,
    author: "Dr. James Mwangi",
    publishDate: "2024-01-15",
    readTime: 8,
    tags: ["soil", "sustainability", "organic", "conservation"],
    views: 12450,
    likes: 892,
    featured: true,
    difficulty: "intermediate",
    image:
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80",
  },
  {
    id: "2",
    title: "Integrated Pest Management (IPM): A Complete Guide",
    summary:
      "Master the art of controlling pests effectively while minimizing chemical use and environmental impact.",
    content: `Integrated Pest Management (IPM) is a holistic approach to pest control that combines biological, cultural, physical, and chemical tools to minimize health, environmental, and economic risks.

## Principles of IPM

### 1. Prevention
- Choose disease-resistant varieties
- Maintain healthy plants through proper nutrition
- Practice crop rotation
- Ensure proper spacing for air circulation

### 2. Monitoring
- Regular field scouting
- Use pheromone traps
- Monitor weather conditions
- Document pest populations

### 3. Identification
- Accurate pest identification is crucial
- Distinguish between pests and beneficial insects
- Understand pest life cycles
- Consult experts when unsure

### 4. Action Thresholds
- Determine when pest populations warrant action
- Consider economic injury levels
- Factor in beneficial insect populations
- Account for crop growth stage

## Biological Control Methods

### Natural Enemies
- **Predators**: Ladybugs, lacewings, predatory mites
- **Parasitoids**: Parasitic wasps
- **Pathogens**: Bacillus thuringiensis (Bt), Beauveria bassiana

### Conservation Biological Control
- Provide habitat for beneficial insects
- Reduce broad-spectrum pesticide use
- Plant flowering borders
- Maintain beetle banks

## Cultural Control

### Crop Rotation
Rotate crops to break pest cycles and reduce buildup of soil-borne pests.

### Sanitation
- Remove crop residues promptly
- Clean equipment between fields
- Eliminate weed hosts
- Properly dispose of infected plants

### Timing
- Adjust planting dates to avoid peak pest periods
- Harvest at optimal maturity
- Use early/late planting to escape pest pressure

## Physical and Mechanical Control

- Row covers and netting
- Handpicking (for large pests)
- Water sprays to dislodge aphids
- Sticky traps
- Mulching to suppress weeds

## Chemical Control (Last Resort)

When chemical control is necessary:
- Select targeted pesticides
- Rotate chemical classes
- Apply at optimal timing
- Follow safety protocols
- Protect pollinators

## Conclusion

IPM reduces pesticide reliance while maintaining effective pest control, protecting both farm profitability and environmental health.`,
    category: "Pest Management",
    categoryIcon: <Bug className="w-5 h-5" />,
    author: "Dr. Sarah Ochieng",
    publishDate: "2024-01-20",
    readTime: 12,
    tags: ["pests", "biological control", "IPM", "organic"],
    views: 9870,
    likes: 743,
    featured: true,
    difficulty: "intermediate",
    image:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80",
  },
  {
    id: "3",
    title: "Water-Smart Irrigation: Efficient Techniques for Every Farm",
    summary:
      "Optimize your water usage with modern irrigation techniques that save water while maximizing crop yields.",
    content: `Water is becoming increasingly scarce and expensive. Efficient irrigation is essential for sustainable agriculture and farm profitability.

## Understanding Crop Water Needs

### Factors Affecting Water Requirements
- Crop type and growth stage
- Soil type and water-holding capacity
- Weather conditions (temperature, humidity, wind)
- Evapotranspiration rates
- Root depth

### Water Stress Indicators
- Wilting during cooler parts of the day
- Leaf curling or rolling
- Stunted growth
- Reduced fruit set
- Poor grain filling

## Irrigation Methods Comparison

### Surface Irrigation
**Pros**: Low cost, simple technology
**Cons**: High water loss, uneven distribution
**Best for**: Flat terrain, rice paddies

### Drip Irrigation
**Pros**: 90-95% efficiency, precise application, reduces disease
**Cons**: Higher initial cost, requires filtration
**Best for**: Row crops, orchards, vegetables

### Sprinkler Irrigation
**Pros**: Versatile, moderate efficiency (75-85%)
**Cons**: Wind sensitivity, leaf wetness issues
**Best for**: Large fields, forage crops

### Center Pivot
**Pros**: Efficient for large areas, mechanized
**Cons**: High capital cost, circular fields only
**Best for**: Grains, large-scale operations

## Smart Irrigation Scheduling

### Soil Moisture Monitoring
- Tensiometers
- Capacitance probes
- TDR sensors
- tensiometer apps

### Evapotranspiration-Based Scheduling
- Use reference ET data
- Apply crop coefficients (Kc)
- Adjust for rainfall
- Account for irrigation efficiency

### Weather-Based Scheduling
- Monitor forecast data
- Adjust for upcoming rain events
- Avoid irrigation before heavy rain
- Consider temperature and humidity

## Water Conservation Practices

### Soil Management
- Increase organic matter
- Maintain surface residue
- Use conservation tillage
- Improve soil structure

### Crop Management
- Select drought-tolerant varieties
- Adjust planting dates
- Use mulching
- Practice deficit irrigation

### Infrastructure
- Fix leaks promptly
- Maintain irrigation equipment
- Use flow meters
- Optimize pump efficiency

## Conclusion

Smart irrigation saves water, reduces costs, and can improve crop quality. Invest in monitoring technology for optimal results.`,
    category: "Irrigation",
    categoryIcon: <Droplets className="w-5 h-5" />,
    author: "Eng. Peter Kamau",
    publishDate: "2024-02-01",
    readTime: 10,
    tags: ["irrigation", "water", "efficiency", "drip"],
    views: 8540,
    likes: 654,
    featured: false,
    difficulty: "intermediate",
    image:
      "https://images.unsplash.com/photo-1501004318855-e731e70f3c33?w=600&q=80",
  },
  {
    id: "4",
    title: "Climate-Smart Agriculture: Adapting to Changing Weather",
    summary:
      "Prepare your farm for climate variability with proven adaptation strategies and resilient practices.",
    content: `Climate change poses significant challenges to agriculture worldwide. Climate-Smart Agriculture (CSA) helps farmers adapt while reducing greenhouse gas emissions.

## Understanding Climate Risks

### Common Climate Threats
- **Droughts**: Extended dry periods
- **Flooding**: Excessive rainfall events
- **Heat stress**: Extreme temperature spikes
- **Frost**: Unexpected cold snaps
- **Changing seasons**: Altered rainfall patterns

### Regional Climate Trends
- Shifting rainy seasons
- More intense rainfall events
- Higher average temperatures
- Increased pest and disease pressure

## Adaptation Strategies

### 1. Drought-Resistant Varieties
- Select varieties bred for drought tolerance
- Consider early-maturing varieties
- Use drought-tolerant rootstocks
- Test varieties in local conditions

### 2. Water Harvesting
- Construct farm ponds
- Install rainwater collection systems
- Use contour bunds and terraces
- Create swales and berms

### 3. Soil Moisture Conservation
- Apply mulch (organic or synthetic)
- Use conservation tillage
- Maintain ground cover
- Build soil organic matter

### 4. Diversification
- Grow multiple crop types
- Integrate livestock
- Plant trees (agroforestry)
- Develop alternative income sources

### 5. Adjusted Timing
- Shift planting dates based on rainfall
- Use short-duration varieties
- Plan irrigation schedules flexibly
- Prepare for early/late seasons

## Mitigation Practices

### Carbon Sequestration
- Plant trees on farms
- Use cover crops
- Apply biochar
- Practice agroforestry

### Reduced Emissions
- Optimize fertilizer use
- Improve manure management
- Use renewable energy
- Reduce tillage

## Risk Management Tools

### Financial Protection
- Crop insurance
- Weather-index insurance
- Savings and credit
- Diversified income

### Information Services
- Weather forecasting apps
- Early warning systems
- Seasonal climate outlooks
- Extension services

## Conclusion

Climate-smart agriculture builds resilience while protecting the environment. Start with one or two practices and expand over time.`,
    category: "Climate & Weather",
    categoryIcon: <Sun className="w-5 h-5" />,
    author: "Dr. Grace Njeri",
    publishDate: "2024-02-10",
    readTime: 11,
    tags: ["climate", "adaptation", "resilience", "drought"],
    views: 7230,
    likes: 521,
    featured: false,
    difficulty: "intermediate",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80",
  },
  {
    id: "5",
    title: "Small-Scale Farm Mechanization: Affordable Solutions",
    summary:
      "Discover cost-effective mechanization options that can transform productivity for smallholder farmers.",
    content: `Mechanization is key to improving farm productivity, but smallholder farmers often face barriers to accessing expensive equipment. This guide covers affordable solutions.

## Benefits of Mechanization

### Productivity Gains
- Faster land preparation
- More timely planting and harvesting
- Reduced labor requirements
- Better quality operations

### Economic Benefits
- Lower labor costs per hectare
- Increased cultivated area
- Reduced post-harvest losses
- Higher returns on investment

## Appropriate Technologies for Small Farms

### Animal-Drawn Equipment
- Plows and harrows
- Seed drills
- Transport carts
- Cost: $200-1,000

### Two-Wheel Tractors (Power Tillers)
- Multi-purpose machines
- 8-15 HP engines
- Various attachments available
- Cost: $1,000-3,000

### Small Four-Wheel Tractors
- 20-35 HP range
- Suitable for 2-10 hectares
- Multiple implement compatibility
- Cost: $5,000-15,000

### Hand Tools (Improved)
- Jab planters
- Mega planters
- Rotary weeders
- Cost: $20-200

## Mechanization by Operation

### Land Preparation
- Primary tillage: Plowing/discing
- Secondary tillage: Harrowing/rolling
- Bed formation: Ridgers/bed shapers

### Planting
- Direct seeders
- Transplanters
- Jab planters for small areas

### Crop Care
- Knapsack sprayers (manual/motorized)
- Boom sprayers for larger areas
- Weeding equipment

### Harvesting
- Reapers (manual/powered)
- Threshers (drum/belt)
- Shellers for grains

### Post-Harvest
- Dryers (solar/mechanical)
- Milling equipment
- Storage solutions

## Access Models

### Equipment Sharing
- Farmer cooperatives
- Custom hiring centers
- Equipment libraries
- Shared ownership

### Financial Solutions
- Equipment loans
- Leasing arrangements
- Hire purchase
- Subsidies and grants

## Selection Considerations

- Farm size and terrain
- Crop types grown
- Available labor
- Technical skills
- Maintenance capacity
- Local support services

## Conclusion

Start with basic mechanization and upgrade as your farm grows. Cooperative ownership can make larger equipment accessible.`,
    category: "Farm Equipment",
    categoryIcon: <Tractor className="w-5 h-5" />,
    author: "Eng. Michael Otieno",
    publishDate: "2024-02-15",
    readTime: 9,
    tags: ["mechanization", "equipment", "smallholder", "technology"],
    views: 6540,
    likes: 432,
    featured: false,
    difficulty: "beginner",
    image:
      "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&q=80",
  },
  {
    id: "6",
    title: "Crop Nutrition: Understanding Fertilizer Management",
    summary:
      "Master the science of crop nutrition to optimize fertilizer use and maximize yields cost-effectively.",
    content: `Proper nutrition is essential for crop health and productivity. Understanding fertilizer management helps farmers apply the right nutrients in the right amounts at the right time.

## Essential Plant Nutrients

### Macronutrients (needed in large amounts)
- **Nitrogen (N)**: Leaf growth, green color
- **Phosphorus (P)**: Root development, flowering
- **Potassium (K)**: Disease resistance, fruit quality

### Secondary Nutrients
- **Calcium (Ca)**: Cell wall structure
- **Magnesium (Mg)**: Chlorophyll production
- **Sulfur (S)**: Protein synthesis

### Micronutrients (needed in small amounts)
- Iron (Fe), Manganese (Mn), Zinc (Zn)
- Copper (Cu), Boron (B), Molybdenum (Mo)

## Soil Testing and Recommendations

### When to Test
- Before planting season
- After major soil amendments
- When yields decline unexpectedly
- Every 2-3 years minimum

### What to Test
- Soil pH
- Organic matter
- Available N, P, K
- Secondary and micronutrients
- Cation Exchange Capacity

## Fertilizer Types

### Organic Sources
- Compost and manure
- Bone meal, blood meal
- Green manures/cover crops
- Bio-fertilizers

### Inorganic/Chemical
- Urea (46-0-0)
- DAP (18-46-0)
- NPK blends
- Foliar sprays

### Slow-Release
- Coated fertilizers
- Polymer-coated
- Organic-based slow-release

## Application Methods

### Broadcast Application
- Uniform field distribution
- Best for P and K
- Incorporate into soil

### Band Placement
- Near seed or root zone
- More efficient for P
- Reduces total fertilizer needed

### Foliar Application
- Direct leaf absorption
- Quick correction of deficiencies
- Best for micronutrients

### fertigation
- Through irrigation systems
- Precise application
- High efficiency

## Crop-Specific Recommendations

### Cereals (Maize, Wheat, Rice)
- High N requirement
- Moderate P and K
- Split N applications

### Legumes
- Low N need (fix nitrogen)
- High P and K
- Inoculants help

### Vegetables
- Balanced NPK
- Regular small doses
- Micronutrient attention

## Common Mistakes to Avoid

- Over-application of nitrogen
- Ignoring soil pH
- Not incorporating fertilizers
- Wrong timing of application
- Neglecting micronutrients

## Conclusion

Soil testing and balanced nutrition optimize input costs while maximizing yields. Consider both organic and inorganic sources.`,
    category: "Crop Nutrition",
    categoryIcon: <Wheat className="w-5 h-5" />,
    author: "Dr. Faith Wambui",
    publishDate: "2024-02-20",
    readTime: 10,
    tags: ["fertilizer", "nutrition", "NPK", "soil testing"],
    views: 11200,
    likes: 867,
    featured: true,
    difficulty: "beginner",
    image:
      "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=600&q=80",
  },
  {
    id: "7",
    title: "Post-Harvest Handling: Reducing Losses and Improving Quality",
    summary:
      "Learn proper post-harvest techniques to minimize losses and maintain crop quality from farm to market.",
    content: `Post-harvest losses can reach 30-40% in developing countries. Proper handling after harvest is crucial for maximizing farm income.

## Understanding Post-Harvest Losses

### Types of Losses
- **Quantity losses**: Weight/volume reduction
- **Quality losses**: Reduced grade/value
- **Nutritional losses**: Degraded nutritional content

### Common Causes
- Mechanical damage during harvest
- Improper drying and storage
- Pest and disease infestation
- Poor handling practices

## Harvesting Best Practices

### Timing
- Harvest at optimal maturity
- Consider weather forecasts
- Plan for labor availability
- Match market requirements

### Methods
- Use appropriate tools
- Minimize mechanical damage
- Handle produce gently
- Harvest in cool hours

### Equipment
- Sharp cutting tools
- Clean containers
- Appropriate machinery
- Protective materials

## Drying Methods

### Sun Drying
- Low cost, widely available
- Requires dry weather
- Risk of re-wetting
- Suitable for grains, spices

### Mechanical Drying
- Fast and controlled
- Higher cost
- Better quality retention
- Essential for commercial operations

### Solar Drying
- Moderate cost
- Protected from weather
- Good quality results
- Sustainable option

## Storage Solutions

### Traditional Methods
- Granaries and silos
- Raised storage
- Hermetic bags
- Smoke treatment

### Modern Storage
- Metal silos
- Cold storage
- Controlled atmosphere
- Hermetic containers

### Storage Conditions
- Cool temperature
- Low humidity
- Good ventilation
- Pest-free environment

## Quality Preservation

### Grading and Sorting
- Remove damaged items
- Sort by size and quality
- Remove foreign matter
- Standardize packaging

### Packaging
- Appropriate containers
- Ventilation requirements
- Stack strength
- Labeling and tracking

### Transportation
- Vehicle preparation
- Loading techniques
- Route planning
- Temperature management

## Value Addition

### Simple Processing
- Cleaning and grading
- Milling and processing
- Packaging and branding
- Basic preservation

## Conclusion

Investing in post-harvest infrastructure reduces losses and increases farm income significantly.`,
    category: "Post-Harvest",
    categoryIcon: <Apple className="w-5 h-5" />,
    author: "Dr. Alice Njoroge",
    publishDate: "2024-03-01",
    readTime: 11,
    tags: ["post-harvest", "storage", "quality", "losses"],
    views: 8920,
    likes: 678,
    featured: false,
    difficulty: "beginner",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",
  },
  {
    id: "8",
    title: "Agroforestry: Integrating Trees into Farming Systems",
    summary:
      "Discover how combining trees with crops and livestock can improve farm productivity and sustainability.",
    content: `Agroforestry integrates trees and shrubs with crops and/or livestock to create more diverse, productive, and sustainable farming systems.

## Benefits of Agroforestry

### Environmental Benefits
- Carbon sequestration
- Soil conservation
- Biodiversity enhancement
- Water cycle improvement
- Microclimate regulation

### Economic Benefits
- Diversified income sources
- Improved crop yields
- Reduced input costs
- Long-term timber income
- Risk reduction

### Social Benefits
- Improved nutrition
- Fuelwood provision
- Enhanced landscapes
- Cultural values

## Agroforestry Systems

### Alley Cropping
- Rows of trees with crops between
- Pruning provides mulch and nutrients
- Examples: Leucaena-maize, Gliricidia-beans

### Silvopasture
- Trees integrated with pasture and livestock
- Shade for animals
- Improved forage quality
- Carbon storage

### Forest Farming
- Cultivating crops under forest canopy
- High-value specialty crops
- Minimal forest disturbance
- Long-term sustainability

### Riparian Buffers
- Trees along waterways
- Erosion prevention
- Water quality protection
- Wildlife habitat

### Home Gardens
- Diverse multi-story systems
- Food security
- Nutrition diversity
- Low external inputs

## Tree Species Selection

### Nitrogen-Fixing Trees
- Leucaena leucocephala
- Gliricidia sepium
- Sesbania sesban
- Faidherbia albida

### Fruit Trees
- Mango, avocado, citrus
- Papaya, banana
- Indigenous fruits
- Nut trees

### Timber Trees
- Grevillea robusta
- Cypress species
- Eucalyptus (careful selection)
- Indigenous hardwoods

## Design Considerations

### Spacing
- Crop light requirements
- Tree growth rates
- Root competition
- Management access

### Management
- Pruning regimes
- Tree coppicing
- Root management
- Harvest timing

## Implementation Steps

1. Assess farm conditions
2. Select appropriate system
3. Choose suitable species
4. Plan layout and spacing
5. Establish nursery or source seedlings
6. Plant and establish
7. Manage and maintain
8. Monitor and adapt

## Conclusion

Agroforestry offers multiple benefits and can be adapted to various farming systems and climatic conditions.`,
    category: "Agroforestry",
    categoryIcon: <TreePine className="w-5 h-5" />,
    author: "Prof. David Maina",
    publishDate: "2024-03-10",
    readTime: 12,
    tags: ["agroforestry", "trees", "sustainability", "diversification"],
    views: 5670,
    likes: 423,
    featured: false,
    difficulty: "advanced",
    image:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&q=80",
  },
  {
    id: "9",
    title: "Market Access and Value Chains for Smallholder Farmers",
    summary:
      "Navigate agricultural markets effectively and connect with buyers to get fair prices for your produce.",
    content: `Getting fair prices for farm produce requires understanding market dynamics and building effective value chain connections.

## Understanding Agricultural Markets

### Market Types
- **Local markets**: Village/shopping centers
- **Regional markets**: Towns and cities
- **National markets**: Wholesale/warehouse
- **Export markets**: International trade
- **Online markets**: Digital platforms

### Price Determinants
- Supply and demand
- Quality and grading
- Seasonal fluctuations
- Transport costs
- Market information

## Value Chain Concepts

### What is a Value Chain?
The sequence of activities from production to consumption that adds value at each stage.

### Key Value Chain Actors
- Input suppliers
- Farmers/producers
- Aggregators/cooperatives
- Processors
- Wholesalers
- Retailers
- Consumers

### Adding Value
- Quality improvement
- Grading and sorting
- Processing and packaging
- Branding and marketing
- Direct sales

## Market Linkage Strategies

### Cooperatives and Groups
- Pool production volume
- Bargain collectively
- Share market information
- Access better prices

### Contract Farming
- Agreements with buyers
- Guaranteed markets
- Technical support
- Premium prices for quality

### Direct Marketing
- Farmers' markets
- Community Supported Agriculture
- Restaurant/hotel supply
- Online sales

### Aggregation
- Collection centers
- Warehouse receipt systems
- Auction platforms
- Digital marketplaces

## Market Information Systems

### Sources
- Government reports
- Price apps and SMS services
- Market information platforms
- Extension services
- Radio and TV

### Using Market Information
- Track price trends
- Time sales strategically
- Compare markets
- Plan production

## Quality and Standards

### Grading Requirements
- Size specifications
- Quality parameters
- Packaging standards
- Food safety requirements

### Certification
- Organic certification
- Quality marks
- Export standards
- Fair trade labels

## Financial Services

### Market-Related Finance
- Pre-harvest finance
- Warehouse receipt loans
- Trade finance
- Invoice factoring

### Risk Management
- Price hedging
- Contract options
- Savings mechanisms
- Insurance products

## Digital Solutions

### Apps and Platforms
- Mobile market information
- E-commerce platforms
- Digital payments
- Logistics matching

### Benefits
- Wider market access
- Reduced transaction costs
- Faster payments
- Better traceability

## Conclusion

Market access requires planning, quality focus, and strategic connections. Start with local markets and expand as you build capacity.`,
    category: "Marketing",
    categoryIcon: <BarChart3 className="w-5 h-5" />,
    author: "Dr. Samuel Kiprop",
    publishDate: "2024-03-15",
    readTime: 13,
    tags: ["marketing", "value chain", "cooperative", "market access"],
    views: 7890,
    likes: 567,
    featured: false,
    difficulty: "intermediate",
    image:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&q=80",
  },
  {
    id: "10",
    title: "Organic Farming: A Practical Guide for Beginners",
    summary:
      "Start your organic farming journey with this comprehensive guide covering certification, practices, and marketing.",
    content: `Organic farming avoids synthetic inputs and focuses on natural processes to build soil health and produce nutritious food.

## Principles of Organic Farming

### Health
- Build soil health for plant health
- Produce nutritious food
- Avoid harmful chemicals
- Protect farmer health

### Ecology
- Work with natural systems
- Recycle resources
- Conserve biodiversity
- Protect ecosystems

### Fairness
- Fair relationships with environment
- Equitable treatment of all
- Responsible resource use

### Care
- Precautionary approach
- Safe technology
- Transparent practices

## Transition to Organic

### Timeline
- 2-3 year transition period
- Build soil health first
- Develop organic skills
- Establish market connections

### Steps
1. Assess current practices
2. Create transition plan
3. Eliminate prohibited inputs
4. Build soil organic matter
5. Implement organic practices
6. Document everything

## Soil Management

### Building Fertility
- Composting
- Green manures
- Crop rotation
- Bio-fertilizers

### Cover Cropping
- Legumes for nitrogen
- Grasses for biomass
- Mixes for diversity
- Seasonal selection

### Mulching
- Organic materials
- Weed suppression
- Moisture conservation
- Temperature moderation

## Pest and Disease Management

### Prevention
- Healthy soil and plants
- Crop rotation
- Resistant varieties
- Proper spacing

### Biological Control
- Beneficial insects
- Microbial pesticides
- Botanical extracts
- Companion planting

### Physical Methods
- Row covers
- Traps
- Handpicking
- Water sprays

## Weed Management

### Cultural Methods
- Dense planting
- Mulching
- Cover crops
- Crop rotation

### Mechanical Methods
- Hand weeding
- Cultivation
- Flame weeding
- Solarization

## Organic Certification

### Requirements
- Comply with standards
- Maintain records
- Allow inspections
- Pay certification fees

### Benefits
- Premium prices
- Market access
- Consumer trust
- Export eligibility

## Organic Marketing

### Channels
- Organic shops
- Farmers' markets
- CSA programs
- Online sales
- Restaurants

### Value Proposition
- Health benefits
- Environmental care
- Quality taste
- Local support

## Economics of Organic

### Cost Considerations
- Higher labor costs
- Lower input costs
- Certification expenses
- Premium prices

### Financial Planning
- Budget carefully
- Start small
- Track costs
- Monitor returns

## Conclusion

Organic farming requires knowledge and dedication but offers environmental, health, and economic benefits.`,
    category: "Organic Farming",
    categoryIcon: <Leaf className="w-5 h-5" />,
    author: "Dr. Mary Wanjiku",
    publishDate: "2024-03-20",
    readTime: 14,
    tags: ["organic", "certification", "natural", "sustainable"],
    views: 13450,
    likes: 1023,
    featured: true,
    difficulty: "beginner",
    image:
      "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80",
  },
];

// ============================================================
// Categories
// ============================================================
const categories: Category[] = [
  {
    id: "all",
    name: "All Topics",
    icon: <BookOpen className="w-5 h-5" />,
    count: articles.length,
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "Soil Management",
    name: "Soil Management",
    icon: <Leaf className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Soil Management").length,
    color: "from-amber-600 to-orange-700",
  },
  {
    id: "Pest Management",
    name: "Pest Management",
    icon: <Bug className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Pest Management").length,
    color: "from-red-500 to-rose-600",
  },
  {
    id: "Irrigation",
    name: "Irrigation",
    icon: <Droplets className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Irrigation").length,
    color: "from-blue-500 to-cyan-600",
  },
  {
    id: "Climate & Weather",
    name: "Climate & Weather",
    icon: <Sun className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Climate & Weather").length,
    color: "from-yellow-500 to-amber-600",
  },
  {
    id: "Farm Equipment",
    name: "Farm Equipment",
    icon: <Tractor className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Farm Equipment").length,
    color: "from-gray-500 to-slate-600",
  },
  {
    id: "Crop Nutrition",
    name: "Crop Nutrition",
    icon: <Wheat className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Crop Nutrition").length,
    color: "from-green-600 to-emerald-700",
  },
  {
    id: "Post-Harvest",
    name: "Post-Harvest",
    icon: <Apple className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Post-Harvest").length,
    color: "from-pink-500 to-rose-600",
  },
  {
    id: "Agroforestry",
    name: "Agroforestry",
    icon: <TreePine className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Agroforestry").length,
    color: "from-emerald-600 to-green-700",
  },
  {
    id: "Marketing",
    name: "Marketing",
    icon: <BarChart3 className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Marketing").length,
    color: "from-indigo-500 to-purple-600",
  },
  {
    id: "Organic Farming",
    name: "Organic Farming",
    icon: <Leaf className="w-5 h-5" />,
    count: articles.filter((a) => a.category === "Organic Farming").length,
    color: "from-lime-500 to-green-600",
  },
];

// ============================================================
// Helper Functions
// ============================================================
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatNumber = (num: number) => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
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
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
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
  }, [searchQuery, selectedCategory, difficultyFilter]);

  // Featured articles
  const featuredArticles = articles.filter((a) => a.featured);

  // Toggle bookmark
  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Render article content with markdown-like formatting
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("## ")) {
        return (
          <h2
            key={i}
            className="text-xl font-bold text-foreground mt-8 mb-4"
          >
            {line.replace("## ", "")}
          </h2>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <h3
            key={i}
            className="text-lg font-semibold text-foreground mt-6 mb-3"
          >
            {line.replace("### ", "")}
          </h3>
        );
      }
      if (line.startsWith("- **")) {
        const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)$/);
        if (match) {
          return (
            <li key={i} className="ml-4 mb-2 text-muted-foreground">
              <strong className="text-foreground">{match[1]}</strong>
              {match[2] ? `: ${match[2]}` : ""}
            </li>
          );
        }
      }
      if (line.startsWith("- ")) {
        return (
          <li key={i} className="ml-4 mb-1 text-muted-foreground list-disc">
            {line.replace("- ", "")}
          </li>
        );
      }
      if (line.match(/^\d+\./)) {
        return (
          <li key={i} className="ml-4 mb-1 text-muted-foreground list-decimal">
            {line.replace(/^\d+\.\s*/, "")}
          </li>
        );
      }
      if (line.trim() === "") {
        return <br key={i} />;
      }
      return (
        <p key={i} className="mb-2 text-muted-foreground leading-relaxed">
          {line}
        </p>
      );
    });
  };

  // Article Detail View
  if (selectedArticle) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20"
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Back Button */}
          <button
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Knowledge Base
          </button>

          {/* Article Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                {selectedArticle.category}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(selectedArticle.difficulty)}`}
              >
                {selectedArticle.difficulty.charAt(0).toUpperCase() +
                  selectedArticle.difficulty.slice(1)}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {selectedArticle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {selectedArticle.author}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {selectedArticle.readTime} min read
              </span>
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {formatNumber(selectedArticle.views)} views
              </span>
              <span>{formatDate(selectedArticle.publishDate)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => toggleBookmark(selectedArticle.id, e)}
                className={`p-2 rounded-lg border transition-colors ${
                  bookmarked.has(selectedArticle.id)
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
                <Printer className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Article Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-8"
          >
            <img
              src={selectedArticle.image}
              alt={selectedArticle.title}
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Article Content */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="prose prose-lg max-w-none"
          >
            {renderContent(selectedArticle.content)}
          </motion.article>

          {/* Tags */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {selectedArticle.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-muted text-sm text-muted-foreground"
                >
                  {tag}
                </span>
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Knowledge Base
            </h1>
          </div>
          <p className="text-muted-foreground ml-14">
            Expert agronomy articles and best practices to improve your farming
          </p>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
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
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Difficulty Filter */}
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Featured Articles */}
        {selectedCategory === "all" && !searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Featured Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredArticles.map((article) => (
                <motion.div
                  key={article.id}
                  whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => setSelectedArticle(article)}
                  className="relative cursor-pointer rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-all"
                >
                  <div className="relative h-32">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-medium bg-primary/90 text-white">
                      Featured
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {article.readTime} min
                      <span className="text-muted-foreground/50">•</span>
                      {article.category}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Categories
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
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedCategory === cat.id
                      ? "bg-white/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredArticles.length} of {articles.length} articles
        </div>

        {/* Articles Grid/List */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "flex flex-col gap-4"
          }
        >
          {filteredArticles.map((article) => (
            <motion.div
              key={article.id}
              variants={itemVariants}
              whileHover={{ y: viewMode === "grid" ? -4 : 0 }}
              onClick={() => setSelectedArticle(article)}
              className={`cursor-pointer bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all ${
                viewMode === "list" ? "flex" : ""
              }`}
            >
              {/* Image */}
              <div
                className={`relative ${viewMode === "list" ? "w-48 flex-shrink-0" : "h-48"}`}
              >
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => toggleBookmark(article.id, e)}
                  className={`absolute top-3 right-3 p-2 rounded-lg backdrop-blur-sm transition-colors ${
                    bookmarked.has(article.id)
                      ? "bg-primary/90 text-white"
                      : "bg-black/30 text-white hover:bg-black/50"
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    {article.categoryIcon}
                    {article.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(article.difficulty)}`}
                  >
                    {article.difficulty}
                  </span>
                </div>

                <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                  {article.title}
                </h3>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {article.summary}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {article.author.split(" ").slice(-1)[0]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.readTime}m
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {formatNumber(article.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {formatNumber(article.likes)}
                    </span>
                  </div>
                </div>

                {/* Tags Preview */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{article.tags.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Read More Arrow */}
              <div
                className={`flex items-center justify-center ${viewMode === "list" ? "px-4" : "px-4 pb-4"}`}
              >
                <div className="flex items-center gap-1 text-sm font-medium text-primary">
                  Read
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredArticles.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No articles found
            </h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setDifficultyFilter("all");
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Clear Filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
