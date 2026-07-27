// ============================================================
// FarmBond Internationalization (i18n)
// Supports: English (en), Swahili (sw), French (fr)
// ============================================================

export type Locale = "en" | "sw" | "fr";

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const locales: LocaleConfig[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
];

// ============================================================
// Translation Strings
// ============================================================

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.farms": "My Farms",
    "nav.crops": "Crops",
    "nav.livestock": "Livestock",
    "nav.weather": "Weather",
    "nav.aiAssistant": "AI Assistant",
    "nav.calendar": "Calendar",
    "nav.finances": "Finances",
    "nav.analytics": "Analytics",
    "nav.community": "Community",
    "nav.marketplace": "Marketplace",
    "nav.admin": "Admin",
    "nav.settings": "Settings",
    "nav.logout": "Logout",

    // Dashboard
    "dashboard.welcome": "Good morning",
    "dashboard.subtitle": "Here's what's happening on your farm today.",
    "dashboard.activeFarms": "Active Farms",
    "dashboard.activeCrops": "Active Crops",
    "dashboard.livestock": "Livestock",
    "dashboard.monthlyProfit": "Monthly Profit",
    "dashboard.quickActions": "Quick Actions",
    "dashboard.addFarm": "Add Farm",
    "dashboard.addCrop": "Add Crop",
    "dashboard.addLivestock": "Add Livestock",
    "dashboard.farmHealth": "Farm Health Overview",
    "dashboard.recentActivity": "Recent Activity",
    "dashboard.upcomingTasks": "Upcoming Tasks",

    // Weather
    "weather.title": "Weather Intelligence",
    "weather.subtitle": "Real-time weather data and agricultural forecasts",
    "weather.currentWeather": "Current Weather",
    "weather.hourlyForecast": "Hourly Forecast",
    "weather.weeklyForecast": "7-Day Forecast",
    "weather.soilConditions": "Soil Conditions",
    "weather.alerts": "Agricultural Alerts",
    "weather.recommendations": "Weather-Based Recommendations",
    "weather.humidity": "Humidity",
    "weather.wind": "Wind",
    "weather.uvIndex": "UV Index",
    "weather.feelsLike": "Feels like",
    "weather.refresh": "Refresh",
    "weather.lastUpdated": "Last updated",

    // Crops
    "crops.title": "Crop Management",
    "crops.subtitle": "Track and manage all your crops across farms",
    "crops.addCrop": "Add Crop",
    "crops.search": "Search crops...",
    "crops.activeCrops": "Active Crops",
    "crops.readyToHarvest": "Ready to Harvest",
    "crops.avgHealth": "Avg Health Score",
    "crops.health": "Health",
    "crops.planted": "Planted",
    "crops.expectedYield": "Expected Yield",

    // Livestock
    "livestock.title": "Livestock Management",
    "livestock.subtitle": "Monitor and manage your livestock across all farms",
    "livestock.addLivestock": "Add Livestock",
    "livestock.totalHead": "Total Head",
    "livestock.healthy": "Healthy",
    "livestock.needAttention": "Need Attention",
    "livestock.vaccinationsDue": "Vaccinations Due",

    // Finances
    "finances.title": "Finances",
    "finances.subtitle": "Track income, expenses, and market prices",
    "finances.totalIncome": "Total Income",
    "finances.totalExpenses": "Total Expenses",
    "finances.netProfit": "Net Profit",
    "finances.profitMargin": "Profit Margin",
    "finances.addTransaction": "Add Transaction",
    "finances.export": "Export",
    "finances.marketPrices": "Market Prices",
    "finances.recentTransactions": "Recent Transactions",

    // Calendar
    "calendar.title": "Farm Calendar",
    "calendar.subtitle": "Plan and track your farming activities with weather insights",
    "calendar.addEvent": "Add Event",
    "calendar.allEvents": "All Events",
    "calendar.planting": "Planting",
    "calendar.harvesting": "Harvesting",
    "calendar.fertilizing": "Fertilizing",
    "calendar.pestControl": "Pest Control",
    "calendar.irrigation": "Irrigation",
    "calendar.weatherRecommendations": "Weather-Based Recommendations",
    "calendar.plantingWindow": "Planting Window",
    "calendar.harvestWindow": "Harvest Window",
    "calendar.rainExpected": "Rain Expected",
    "calendar.quickStats": "Quick Stats",

    // Disease Detection
    "detection.title": "Disease & Pest Detection",
    "detection.subtitle": "Upload a photo and get instant AI-powered diagnosis and treatment recommendations",
    "detection.howItWorks": "How It Works",
    "detection.upload": "Upload Plant Image",
    "detection.dragDrop": "Drag and drop an image, or click to browse",
    "detection.analyzing": "Analyzing image...",
    "detection.confidence": "Confidence",
    "detection.symptoms": "Symptoms",
    "detection.causes": "Causes",
    "detection.organicSolutions": "Organic Solutions",
    "detection.chemicalTreatments": "Chemical Treatments",
    "detection.preventionTips": "Prevention Tips",

    // AI Assistant
    "ai.title": "AI Farming Assistant",
    "ai.subtitle": "Get personalized advice on crop health, pest control, and farming best practices",
    "ai.placeholder": "Ask me anything about farming...",
    "ai.thinking": "Thinking...",

    // Community
    "community.title": "Community",
    "community.subtitle": "Connect with farmers and agricultural experts",
    "community.sharePost": "Share with the farming community...",
    "community.post": "Post",

    // Marketplace
    "marketplace.title": "Agronomist Marketplace",
    "marketplace.subtitle": "Connect with expert agricultural consultants",
    "marketplace.bookConsultation": "Book Consultation",
    "marketplace.available": "Available",

    // Admin
    "admin.title": "Admin Dashboard",
    "admin.subtitle": "System overview and management",
    "admin.totalUsers": "Total Users",
    "admin.monthlyRevenue": "Monthly Revenue",
    "admin.activeSubscriptions": "Active Subscriptions",
    "admin.supportTickets": "Support Tickets",

    // Analytics
    "analytics.title": "Analytics",
    "analytics.subtitle": "Insights and performance metrics for your farms",
    "analytics.totalRevenue": "Total Revenue",
    "analytics.cropYield": "Crop Yield",
    "analytics.livestockHealth": "Livestock Health",
    "analytics.waterUsage": "Water Usage",

    // Common
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.retry": "Retry",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View",
    "common.search": "Search...",
    "common.noResults": "No results found",
    "common.viewAll": "View All",
    "common.learnMore": "Learn More",
    "common.getStarted": "Get Started",
    "common.signUp": "Sign Up",
    "common.signIn": "Sign In",
    "common.signOut": "Sign Out",
    "common.profile": "Profile",
    "common.help": "Help & Support",
  },

  sw: {
    // Navigation
    "nav.dashboard": "Dashibodi",
    "nav.farms": "Mazangu",
    "nav.crops": "Mazao",
    "nav.livestock": "Mifugo",
    "nav.weather": "Hali ya Hewa",
    "nav.aiAssistant": "Msaidizi wa AI",
    "nav.calendar": "Kalenda",
    "nav.finances": "Fedha",
    "nav.analytics": "Uchambuzi",
    "nav.community": "Jumuiya",
    "nav.marketplace": "Soko",
    "nav.admin": "Usimamizi",
    "nav.settings": "Mipangilio",
    "nav.logout": "Ondoka",

    // Dashboard
    "dashboard.welcome": "Habari za asubuhi",
    "dashboard.subtitle": "Hii ndiyo inayotokea kwenye shamba lako leo.",
    "dashboard.activeFarms": "Mazao Hai",
    "dashboard.activeCrops": "Mazao Yanayofanya Kazi",
    "dashboard.livestock": "Mifugo",
    "dashboard.monthlyProfit": "Faida ya Mwezi",
    "dashboard.quickActions": "Vitendo vya Haraka",
    "dashboard.addFarm": "Ongeza Shamba",
    "dashboard.addCrop": "Ongeza Mazao",
    "dashboard.addLivestock": "Ongeza Mifugo",
    "dashboard.farmHealth": "Hali ya Afya ya Shamba",
    "dashboard.recentActivity": "Shughuli za Hivi Karibuni",
    "dashboard.upcomingTasks": "Kazi Zinazokuja",

    // Weather
    "weather.title": "Akili ya Hewa",
    "weather.subtitle": "Data ya hali ya hewa ya wakati halisi na utabiri wa kilimo",
    "weather.currentWeather": "Hali ya Hewa ya Sasa",
    "weather.hourlyForecast": "Utabiri wa Kila Saa",
    "weather.weeklyForecast": "Utabiri wa Siku 7",
    "weather.soilConditions": "Hali ya Udongo",
    "weather.alerts": "Tahadhari za Kilimo",
    "weather.recommendations": "Mapendekezo Kulingana na Hewa",
    "weather.humidity": "Unyevu",
    "weather.wind": "Upepo",
    "weather.uvIndex": "Kiwango cha UV",
    "weather.feelsLike": "Inaonekana kama",
    "weather.refresh": "Sasisha",
    "weather.lastUpdated": "Imesasishwa mwisho",

    // Crops
    "crops.title": "Usimamizi wa Mazao",
    "crops.subtitle": "Fuatilia na usimamishe mazao yako yote katika mashamba",
    "crops.addCrop": "Ongeza Mazao",
    "crops.search": "Tafuta mazao...",
    "crops.activeCrops": "Mazao Hai",
    "crops.readyToHarvest": "Tayari Kuvuna",
    "crops.avgHealth": "Wastani wa Afya",
    "crops.health": "Afya",
    "crops.planted": "Imepandwa",
    "crops.expectedYield": "Mavuno Yanayotarajiwa",

    // Livestock
    "livestock.title": "Usimamizi wa Mifugo",
    "livestock.subtitle": "Fuatilia na usimamishe mifugo yako katika mashamba yote",
    "livestock.addLivestock": "Ongeza Mifugo",
    "livestock.totalHead": "Jumla ya Vichwa",
    "livestock.healthy": "Afya Njema",
    "livestock.needAttention": "Inahitaji Uangalifu",
    "livestock.vaccinationsDue": "Chanjo Zinazostahili",

    // Finances
    "finances.title": "Fedha",
    "finances.subtitle": "Fuatilia mapato, gharama, na bei za soko",
    "finances.totalIncome": "Mapato Jumla",
    "finances.totalExpenses": "Gharama Jumla",
    "finances.netProfit": "Faida Halisi",
    "finances.profitMargin": "Margini ya Faida",
    "finances.addTransaction": "Ongeza Muamala",
    "finances.export": "Hamisha",
    "finances.marketPrices": "Bei za Soko",
    "finances.recentTransactions": "Miamala ya Hivi Karibuni",

    // Calendar
    "calendar.title": "Kalenda ya Shamba",
    "calendar.subtitle": "Panga na fuatilia shughuli zako za kilimo kwa maarifa ya hali ya hewa",
    "calendar.addEvent": "Ongeza Tukio",
    "calendar.allEvents": "Matukio Yote",
    "calendar.planting": "Kupanda",
    "calendar.harvesting": "Kuvuna",
    "calendar.fertilizing": "Kutowa Mbolea",
    "calendar.pestControl": "Udhibiti wa Wadudu",
    "calendar.irrigation": "Umwagiliaji",
    "calendar.weatherRecommendations": "Mapendekezo Kulingana na Hewa",
    "calendar.plantingWindow": "Dirisha la Kupanda",
    "calendar.harvestWindow": "Dirisha la Kuvuna",
    "calendar.rainExpected": "Mvua Inatarajiwa",
    "calendar.quickStats": "Takwimu za Haraka",

    // Disease Detection
    "detection.title": "Utambuzi wa Ugonjwa na Wadudu",
    "detection.subtitle": "Pakia picha na upate utambuzi wa haraka na mapendekezo ya matibabu",
    "detection.howItWorks": "Jinsi Inavyofanya Kazi",
    "detection.upload": "Pakia Picha ya Mmea",
    "detection.dragDrop": "Buruta na uache picha, au bofya ili kutafuta",
    "detection.analyzing": "Inachambua picha...",
    "detection.confidence": "Uaminifu",
    "detection.symptoms": "Dalili",
    "detection.causes": "Sababu",
    "detection.organicSolutions": "Suluhisho za Kiasili",
    "detection.chemicalTreatments": "Matibabu ya Kemikali",
    "detection.preventionTips": "Vidokezo vya Kuzuia",

    // AI Assistant
    "ai.title": "Msaidizi wa AI wa Kilimo",
    "ai.subtitle": "Pata ushauri wa kibinafsi kuhusu afya ya mazao, udhibiti wa wadudu, na mazoea bora ya kilimo",
    "ai.placeholder": "Niulize chochote kuhusu kilimo...",
    "ai.thinking": "Inafikiria...",

    // Community
    "community.title": "Jumuiya",
    "community.subtitle": "Unganika na wakulima na wataalamu wa kilimo",
    "community.sharePost": "Shiriki na jumuiya ya wakulima...",
    "community.post": "Chapisha",

    // Marketplace
    "marketplace.title": "Soko la Wataalamu wa Kilimo",
    "marketplace.subtitle": "Unganika na washauri wa kilimo waliobobea",
    "marketplace.bookConsultation": "Hifadhi Ushauri",
    "marketplace.available": "Inapatikana",

    // Admin
    "admin.title": "Dashibodi ya Usimamizi",
    "admin.subtitle": "Muhtasari wa mfumo na usimamizi",
    "admin.totalUsers": "Watumiaji Jumla",
    "admin.monthlyRevenue": "Mapato ya Mwezi",
    "admin.activeSubscriptions": "Usajili Hai",
    "admin.supportTickets": "Tikiti za Usaidizi",

    // Analytics
    "analytics.title": "Uchambuzi",
    "analytics.subtitle": " Maarifa na viashiria vya utendaji kwa mashamba yako",
    "analytics.totalRevenue": "Mapato Jumla",
    "analytics.cropYield": "Mavuno ya Mazao",
    "analytics.livestockHealth": "Afya ya Mifugo",
    "analytics.waterUsage": "Matumizi ya Maji",

    // Common
    "common.loading": "Inapakia...",
    "common.error": "Kuna hitilafu",
    "common.retry": "Jaribu Tena",
    "common.save": "Hifadhi",
    "common.cancel": "Ghairi",
    "common.delete": "Futa",
    "common.edit": "Hariri",
    "common.view": "Tazama",
    "common.search": "Tafuta...",
    "common.noResults": "Hakuna matokeo yaliyopatikana",
    "common.viewAll": "Tazama Yote",
    "common.learnMore": "Jifunze Zaidi",
    "common.getStarted": "Anza",
    "common.signUp": "Jiandikishe",
    "common.signIn": "Ingia",
    "common.signOut": "Ondoka",
    "common.profile": "Wasifu",
    "common.help": "Msaada & Usaidizi",
  },

  fr: {
    // Navigation
    "nav.dashboard": "Tableau de bord",
    "nav.farms": "Mes fermes",
    "nav.crops": "Cultures",
    "nav.livestock": "Bétail",
    "nav.weather": "Météo",
    "nav.aiAssistant": "Assistant IA",
    "nav.calendar": "Calendrier",
    "nav.finances": "Finances",
    "nav.analytics": "Analytique",
    "nav.community": "Communauté",
    "nav.marketplace": "Marché",
    "nav.admin": "Administration",
    "nav.settings": "Paramètres",
    "nav.logout": "Déconnexion",

    // Dashboard
    "dashboard.welcome": "Bonjour",
    "dashboard.subtitle": "Voici ce qui se passe dans votre ferme aujourd'hui.",
    "dashboard.activeFarms": "Fermes actives",
    "dashboard.activeCrops": "Cultures actives",
    "dashboard.livestock": "Bétail",
    "dashboard.monthlyProfit": "Profit mensuel",
    "dashboard.quickActions": "Actions rapides",
    "dashboard.addFarm": "Ajouter une ferme",
    "dashboard.addCrop": "Ajouter une culture",
    "dashboard.addLivestock": "Ajouter du bétail",
    "dashboard.farmHealth": "Santé de la ferme",
    "dashboard.recentActivity": "Activité récente",
    "dashboard.upcomingTasks": "Tâches à venir",

    // Weather
    "weather.title": "Intelligence météorologique",
    "weather.subtitle": "Données météorologiques en temps réel et prévisions agricoles",
    "weather.currentWeather": "Météo actuelle",
    "weather.hourlyForecast": "Prévisions horaires",
    "weather.weeklyForecast": "Prévisions 7 jours",
    "weather.soilConditions": "Conditions du sol",
    "weather.alerts": "Alertes agricoles",
    "weather.recommendations": "Recommandations basées sur la météo",
    "weather.humidity": "Humidité",
    "weather.wind": "Vent",
    "weather.uvIndex": "Indice UV",
    "weather.feelsLike": "Ressenti",
    "weather.refresh": "Actualiser",
    "weather.lastUpdated": "Dernière mise à jour",

    // Crops
    "crops.title": "Gestion des cultures",
    "crops.subtitle": "Suivez et gérez toutes vos cultures sur vos fermes",
    "crops.addCrop": "Ajouter une culture",
    "crops.search": "Rechercher des cultures...",
    "crops.activeCrops": "Cultures actives",
    "crops.readyToHarvest": "Prêt à récolter",
    "crops.avgHealth": "Score de santé moyen",
    "crops.health": "Santé",
    "crops.planted": "Planté",
    "crops.expectedYield": "Rendement attendu",

    // Livestock
    "livestock.title": "Gestion du bétail",
    "livestock.subtitle": "Surveillez et gérez votre bétail dans toutes vos fermes",
    "livestock.addLivestock": "Ajouter du bétail",
    "livestock.totalHead": "Total têtes",
    "livestock.healthy": "En bonne santé",
    "livestock.needAttention": "Nécessite attention",
    "livestock.vaccinationsDue": "Vaccinations dues",

    // Finances
    "finances.title": "Finances",
    "finances.subtitle": "Suivez les revenus, dépenses et prix du marché",
    "finances.totalIncome": "Revenu total",
    "finances.totalExpenses": "Dépenses totales",
    "finances.netProfit": "Bénéfice net",
    "finances.profitMargin": "Marge bénéficiaire",
    "finances.addTransaction": "Ajouter une transaction",
    "finances.export": "Exporter",
    "finances.marketPrices": "Prix du marché",
    "finances.recentTransactions": "Transactions récentes",

    // Calendar
    "calendar.title": "Calendrier agricole",
    "calendar.subtitle": "Planifiez et suivez vos activités agricoles avec des insights météo",
    "calendar.addEvent": "Ajouter un événement",
    "calendar.allEvents": "Tous les événements",
    "calendar.planting": "Plantation",
    "calendar.harvesting": "Récolte",
    "calendar.fertilizing": "Engrais",
    "calendar.pestControl": "Lutte antiparasitaire",
    "calendar.irrigation": "Irrigation",
    "calendar.weatherRecommendations": "Recommandations météo",
    "calendar.plantingWindow": "Fenêtre de plantation",
    "calendar.harvestWindow": "Fenêtre de récolte",
    "calendar.rainExpected": "Pluie prévue",
    "calendar.quickStats": "Statistiques rapides",

    // Disease Detection
    "detection.title": "Détection des maladies et ravageurs",
    "detection.subtitle": "Téléchargez une photo et obtenez un diagnostic IA instantané avec des recommandations de traitement",
    "detection.howItWorks": "Comment ça marche",
    "detection.upload": "Télécharger une image de plante",
    "detection.dragDrop": "Glissez-déposez une image ou cliquez pour parcourir",
    "detection.analyzing": "Analyse de l'image...",
    "detection.confidence": "Confiance",
    "detection.symptoms": "Symptômes",
    "detection.causes": "Causes",
    "detection.organicSolutions": "Solutions biologiques",
    "detection.chemicalTreatments": "Traitements chimiques",
    "detection.preventionTips": "Conseils de prévention",

    // AI Assistant
    "ai.title": "Assistant agricole IA",
    "ai.subtitle": "Obtenez des conseils personnalisés sur la santé des cultures, la lutte antiparasitaire et les meilleures pratiques agricoles",
    "ai.placeholder": "Demandez-moi n'importe quoi sur l'agriculture...",
    "ai.thinking": "Réflexion...",

    // Community
    "community.title": "Communauté",
    "community.subtitle": "Connectez-vous avec des agriculteurs et des experts agricoles",
    "community.sharePost": "Partagez avec la communauté agricole...",
    "community.post": "Publier",

    // Marketplace
    "marketplace.title": "Marché des agronomes",
    "marketplace.subtitle": "Connectez-vous avec des consultants agricoles experts",
    "marketplace.bookConsultation": "Réserver une consultation",
    "marketplace.available": "Disponible",

    // Admin
    "admin.title": "Tableau d'administration",
    "admin.subtitle": "Aperçu du système et gestion",
    "admin.totalUsers": "Utilisateurs totaux",
    "admin.monthlyRevenue": "Revenu mensuel",
    "admin.activeSubscriptions": "Abonnements actifs",
    "admin.supportTickets": "Tickets de support",

    // Analytics
    "analytics.title": "Analytique",
    "analytics.subtitle": "Aperçus et métriques de performance pour vos fermes",
    "analytics.totalRevenue": "Revenu total",
    "analytics.cropYield": "Rendement des cultures",
    "analytics.livestockHealth": "Santé du bétail",
    "analytics.waterUsage": "Consommation d'eau",

    // Common
    "common.loading": "Chargement...",
    "common.error": "Une erreur s'est produite",
    "common.retry": "Réessayer",
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.delete": "Supprimer",
    "common.edit": "Modifier",
    "common.view": "Voir",
    "common.search": "Rechercher...",
    "common.noResults": "Aucun résultat trouvé",
    "common.viewAll": "Voir tout",
    "common.learnMore": "En savoir plus",
    "common.getStarted": "Commencer",
    "common.signUp": "S'inscrire",
    "common.signIn": "Se connecter",
    "common.signOut": "Se déconnecter",
    "common.profile": "Profil",
    "common.help": "Aide et support",
  },
};

// ============================================================
// Translation Function
// ============================================================

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem("farmbond-locale", locale);
    document.documentElement.lang = locale;
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const translation = translations[currentLocale]?.[key] || translations.en[key] || key;

  if (params) {
    return Object.entries(params).reduce(
      (result, [paramKey, paramValue]) =>
        result.replace(new RegExp(`{{${paramKey}}}`, "g"), String(paramValue)),
      translation
    );
  }

  return translation;
}

// ============================================================
// Locale Detection
// ============================================================

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";

  // Check localStorage first
  const stored = localStorage.getItem("farmbond-locale") as Locale | null;
  if (stored && translations[stored]) return stored;

  // Check browser language
  const browserLang = navigator.language.split("-")[0];
  if (browserLang === "sw") return "sw";
  if (browserLang === "fr") return "fr";

  return "en";
}

export function initLocale(): Locale {
  const locale = detectLocale();
  setLocale(locale);
  return locale;
}
