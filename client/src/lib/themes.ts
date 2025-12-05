interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  cardBorder: string;
  popover: string;
  popoverForeground: string;
  popoverBorder: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  buttonOutline: string;
  badgeOutline: string;
  elevate1: string;
  elevate2: string;
  shadowColor: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  darkColors: ThemeColors;
  fonts: {
    heading: string;
    body: string;
  };
  borderRadius: string;
  preview: {
    gradient: string;
    icon: string;
  };
}

export const themes: Record<string, Theme> = {
  cottagecore: {
    id: "cottagecore",
    name: "Cottagecore Fireside",
    description: "Warm, cozy cottage library with honey and cream tones",
    colors: {
      background: "42 35% 96%",
      foreground: "28 25% 18%",
      card: "40 40% 98%",
      cardForeground: "28 25% 18%",
      cardBorder: "38 25% 90%",
      popover: "40 40% 98%",
      popoverForeground: "28 25% 18%",
      popoverBorder: "38 20% 88%",
      primary: "28 70% 52%",
      primaryForeground: "40 40% 98%",
      secondary: "80 20% 88%",
      secondaryForeground: "28 35% 25%",
      accent: "42 85% 88%",
      accentForeground: "28 60% 35%",
      muted: "38 25% 90%",
      mutedForeground: "28 15% 45%",
      destructive: "4 70% 58%",
      destructiveForeground: "40 40% 98%",
      border: "38 20% 88%",
      input: "38 25% 88%",
      ring: "28 70% 52%",
      sidebar: "35 30% 92%",
      sidebarForeground: "28 25% 18%",
      sidebarBorder: "38 20% 84%",
      sidebarPrimary: "28 70% 52%",
      sidebarPrimaryForeground: "40 40% 98%",
      sidebarAccent: "38 25% 88%",
      sidebarAccentForeground: "28 35% 25%",
      sidebarRing: "28 70% 52%",
      chart1: "28 70% 52%",
      chart2: "140 35% 50%",
      chart3: "18 65% 55%",
      chart4: "42 85% 55%",
      chart5: "88 45% 50%",
      buttonOutline: "rgba(101, 67, 33, 0.08)",
      badgeOutline: "rgba(101, 67, 33, 0.04)",
      elevate1: "rgba(101, 67, 33, 0.025)",
      elevate2: "rgba(101, 67, 33, 0.05)",
      shadowColor: "101, 67, 33",
    },
    darkColors: {
      background: "25 18% 12%",
      foreground: "40 35% 90%",
      card: "25 15% 16%",
      cardForeground: "40 35% 90%",
      cardBorder: "28 12% 20%",
      popover: "25 15% 16%",
      popoverForeground: "40 35% 90%",
      popoverBorder: "28 12% 24%",
      primary: "28 75% 58%",
      primaryForeground: "25 18% 12%",
      secondary: "80 12% 26%",
      secondaryForeground: "80 20% 82%",
      accent: "42 60% 32%",
      accentForeground: "42 85% 82%",
      muted: "28 12% 24%",
      mutedForeground: "38 15% 55%",
      destructive: "4 75% 52%",
      destructiveForeground: "40 35% 90%",
      border: "28 12% 22%",
      input: "28 12% 26%",
      ring: "28 75% 58%",
      sidebar: "25 18% 13%",
      sidebarForeground: "40 35% 90%",
      sidebarBorder: "28 12% 20%",
      sidebarPrimary: "28 75% 58%",
      sidebarPrimaryForeground: "25 18% 12%",
      sidebarAccent: "28 12% 24%",
      sidebarAccentForeground: "40 25% 82%",
      sidebarRing: "28 75% 58%",
      chart1: "28 75% 62%",
      chart2: "140 35% 58%",
      chart3: "18 70% 60%",
      chart4: "42 80% 60%",
      chart5: "88 40% 55%",
      buttonOutline: "rgba(255, 220, 180, 0.08)",
      badgeOutline: "rgba(255, 220, 180, 0.04)",
      elevate1: "rgba(255, 220, 180, 0.04)",
      elevate2: "rgba(255, 220, 180, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Vollkorn', 'Georgia', serif",
      body: "'Quicksand', 'Trebuchet MS', sans-serif",
    },
    borderRadius: "1.5rem",
    preview: {
      gradient: "linear-gradient(135deg, #faf6ee 0%, #f5ece0 100%)",
      icon: "🏡",
    },
  },

  baroque: {
    id: "baroque",
    name: "Baroque Opulence",
    description: "17th-century European grandeur with ornate gold",
    colors: {
      background: "35 35% 94%",
      foreground: "340 45% 18%",
      card: "38 40% 96%",
      cardForeground: "340 45% 18%",
      cardBorder: "340 30% 78%",
      popover: "38 40% 96%",
      popoverForeground: "340 45% 18%",
      popoverBorder: "340 30% 75%",
      primary: "340 55% 35%",
      primaryForeground: "42 40% 95%",
      secondary: "35 35% 85%",
      secondaryForeground: "340 45% 18%",
      accent: "45 85% 45%",
      accentForeground: "340 50% 15%",
      muted: "35 25% 88%",
      mutedForeground: "340 25% 40%",
      destructive: "0 70% 50%",
      destructiveForeground: "38 40% 96%",
      border: "340 25% 82%",
      input: "340 20% 85%",
      ring: "340 55% 35%",
      sidebar: "340 25% 92%",
      sidebarForeground: "340 45% 18%",
      sidebarBorder: "340 25% 85%",
      sidebarPrimary: "340 55% 35%",
      sidebarPrimaryForeground: "42 40% 95%",
      sidebarAccent: "340 20% 88%",
      sidebarAccentForeground: "340 45% 18%",
      sidebarRing: "340 55% 35%",
      chart1: "340 55% 40%",
      chart2: "45 85% 50%",
      chart3: "25 70% 45%",
      chart4: "320 45% 45%",
      chart5: "10 60% 45%",
      buttonOutline: "rgba(128, 45, 75, 0.10)",
      badgeOutline: "rgba(128, 45, 75, 0.05)",
      elevate1: "rgba(128, 45, 75, 0.025)",
      elevate2: "rgba(128, 45, 75, 0.05)",
      shadowColor: "100, 40, 60",
    },
    darkColors: {
      background: "340 50% 8%",
      foreground: "42 30% 92%",
      card: "340 40% 12%",
      cardForeground: "42 30% 92%",
      cardBorder: "45 50% 25%",
      popover: "340 40% 12%",
      popoverForeground: "42 30% 92%",
      popoverBorder: "45 50% 30%",
      primary: "51 100% 50%",
      primaryForeground: "340 50% 8%",
      secondary: "345 50% 25%",
      secondaryForeground: "42 30% 92%",
      accent: "45 90% 40%",
      accentForeground: "42 30% 92%",
      muted: "340 30% 16%",
      mutedForeground: "42 25% 65%",
      destructive: "0 70% 50%",
      destructiveForeground: "42 30% 92%",
      border: "45 50% 20%",
      input: "45 50% 25%",
      ring: "51 100% 50%",
      sidebar: "340 50% 10%",
      sidebarForeground: "42 30% 92%",
      sidebarBorder: "45 50% 20%",
      sidebarPrimary: "51 100% 50%",
      sidebarPrimaryForeground: "340 50% 8%",
      sidebarAccent: "340 40% 18%",
      sidebarAccentForeground: "42 30% 88%",
      sidebarRing: "51 100% 50%",
      chart1: "51 100% 55%",
      chart2: "345 60% 60%",
      chart3: "25 80% 55%",
      chart4: "40 90% 60%",
      chart5: "320 50% 55%",
      buttonOutline: "rgba(255, 215, 0, 0.12)",
      badgeOutline: "rgba(255, 215, 0, 0.06)",
      elevate1: "rgba(255, 215, 0, 0.04)",
      elevate2: "rgba(255, 215, 0, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Playfair Display', 'Georgia', serif",
      body: "'Cormorant Garamond', 'Garamond', serif",
    },
    borderRadius: "0.375rem",
    preview: {
      gradient: "linear-gradient(135deg, #f8f2ed 0%, #f0e8e0 100%)",
      icon: "👑",
    },
  },

  acanthus: {
    id: "acanthus",
    name: "Acanthus Classical",
    description: "Greco-Roman botanical elegance with marble and leaf motifs",
    colors: {
      background: "40 15% 94%",
      foreground: "35 25% 18%",
      card: "40 20% 97%",
      cardForeground: "35 25% 18%",
      cardBorder: "35 18% 82%",
      popover: "40 20% 97%",
      popoverForeground: "35 25% 18%",
      popoverBorder: "35 18% 79%",
      primary: "95 35% 32%",
      primaryForeground: "40 20% 97%",
      secondary: "40 18% 86%",
      secondaryForeground: "35 25% 18%",
      accent: "45 55% 42%",
      accentForeground: "35 25% 15%",
      muted: "40 15% 89%",
      mutedForeground: "35 18% 42%",
      destructive: "0 60% 48%",
      destructiveForeground: "40 20% 97%",
      border: "35 16% 80%",
      input: "35 14% 84%",
      ring: "95 35% 32%",
      sidebar: "35 18% 92%",
      sidebarForeground: "35 25% 18%",
      sidebarBorder: "35 16% 82%",
      sidebarPrimary: "95 35% 32%",
      sidebarPrimaryForeground: "40 20% 97%",
      sidebarAccent: "35 15% 87%",
      sidebarAccentForeground: "35 25% 18%",
      sidebarRing: "95 35% 32%",
      chart1: "95 35% 38%",
      chart2: "45 55% 48%",
      chart3: "35 30% 42%",
      chart4: "75 30% 42%",
      chart5: "15 45% 45%",
      buttonOutline: "rgba(80, 100, 65, 0.10)",
      badgeOutline: "rgba(80, 100, 65, 0.05)",
      elevate1: "rgba(80, 100, 65, 0.025)",
      elevate2: "rgba(80, 100, 65, 0.05)",
      shadowColor: "70, 60, 50",
    },
    darkColors: {
      background: "120 20% 10%",
      foreground: "75 20% 90%",
      card: "120 18% 14%",
      cardForeground: "75 20% 90%",
      cardBorder: "120 15% 22%",
      popover: "120 18% 14%",
      popoverForeground: "75 20% 90%",
      popoverBorder: "120 15% 25%",
      primary: "95 50% 50%",
      primaryForeground: "120 20% 10%",
      secondary: "45 30% 25%",
      secondaryForeground: "75 20% 90%",
      accent: "85 40% 40%",
      accentForeground: "75 20% 90%",
      muted: "120 15% 18%",
      mutedForeground: "75 15% 55%",
      destructive: "0 65% 55%",
      destructiveForeground: "75 20% 90%",
      border: "120 15% 20%",
      input: "120 15% 22%",
      ring: "95 50% 50%",
      sidebar: "120 20% 12%",
      sidebarForeground: "75 20% 90%",
      sidebarBorder: "120 15% 18%",
      sidebarPrimary: "95 50% 50%",
      sidebarPrimaryForeground: "120 20% 10%",
      sidebarAccent: "120 18% 18%",
      sidebarAccentForeground: "75 20% 85%",
      sidebarRing: "95 50% 50%",
      chart1: "95 50% 55%",
      chart2: "45 50% 60%",
      chart3: "120 35% 55%",
      chart4: "85 40% 55%",
      chart5: "60 45% 55%",
      buttonOutline: "rgba(122, 157, 84, 0.12)",
      badgeOutline: "rgba(122, 157, 84, 0.06)",
      elevate1: "rgba(122, 157, 84, 0.04)",
      elevate2: "rgba(122, 157, 84, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Cinzel', 'Georgia', serif",
      body: "'Libre Baskerville', 'Baskerville', serif",
    },
    borderRadius: "0.25rem",
    preview: {
      gradient: "linear-gradient(135deg, #e8e4dc 0%, #d4cfc4 100%)",
      icon: "🌿",
    },
  },

  artdeco: {
    id: "artdeco",
    name: "Art Deco Glamour",
    description: "1920s jazz age with geometric patterns and gold accents",
    colors: {
      background: "45 25% 95%",
      foreground: "180 25% 15%",
      card: "45 30% 97%",
      cardForeground: "180 25% 15%",
      cardBorder: "160 30% 75%",
      popover: "45 30% 97%",
      popoverForeground: "180 25% 15%",
      popoverBorder: "160 30% 72%",
      primary: "160 50% 28%",
      primaryForeground: "45 40% 95%",
      secondary: "45 20% 88%",
      secondaryForeground: "180 25% 15%",
      accent: "45 90% 45%",
      accentForeground: "180 30% 12%",
      muted: "45 18% 90%",
      mutedForeground: "180 18% 40%",
      destructive: "0 65% 50%",
      destructiveForeground: "45 30% 97%",
      border: "160 20% 80%",
      input: "160 18% 85%",
      ring: "160 50% 28%",
      sidebar: "160 20% 93%",
      sidebarForeground: "180 25% 15%",
      sidebarBorder: "160 20% 82%",
      sidebarPrimary: "160 50% 28%",
      sidebarPrimaryForeground: "45 40% 95%",
      sidebarAccent: "160 18% 88%",
      sidebarAccentForeground: "180 25% 15%",
      sidebarRing: "160 50% 28%",
      chart1: "160 50% 35%",
      chart2: "45 90% 50%",
      chart3: "200 40% 35%",
      chart4: "180 35% 40%",
      chart5: "30 70% 50%",
      buttonOutline: "rgba(45, 100, 85, 0.10)",
      badgeOutline: "rgba(45, 100, 85, 0.05)",
      elevate1: "rgba(45, 100, 85, 0.025)",
      elevate2: "rgba(45, 100, 85, 0.05)",
      shadowColor: "40, 80, 70",
    },
    darkColors: {
      background: "210 40% 10%",
      foreground: "45 30% 90%",
      card: "210 35% 14%",
      cardForeground: "45 30% 90%",
      cardBorder: "45 60% 30%",
      popover: "210 35% 14%",
      popoverForeground: "45 30% 90%",
      popoverBorder: "45 60% 35%",
      primary: "45 100% 55%",
      primaryForeground: "210 40% 10%",
      secondary: "210 30% 22%",
      secondaryForeground: "45 30% 90%",
      accent: "45 80% 45%",
      accentForeground: "210 40% 10%",
      muted: "210 25% 18%",
      mutedForeground: "210 20% 55%",
      destructive: "0 70% 50%",
      destructiveForeground: "45 30% 90%",
      border: "210 25% 20%",
      input: "210 25% 22%",
      ring: "45 100% 55%",
      sidebar: "210 40% 12%",
      sidebarForeground: "45 30% 90%",
      sidebarBorder: "45 50% 25%",
      sidebarPrimary: "45 100% 55%",
      sidebarPrimaryForeground: "210 40% 10%",
      sidebarAccent: "210 30% 20%",
      sidebarAccentForeground: "45 25% 85%",
      sidebarRing: "45 100% 55%",
      chart1: "45 100% 60%",
      chart2: "210 50% 60%",
      chart3: "180 45% 55%",
      chart4: "30 80% 60%",
      chart5: "260 45% 60%",
      buttonOutline: "rgba(255, 215, 0, 0.12)",
      badgeOutline: "rgba(255, 215, 0, 0.06)",
      elevate1: "rgba(255, 215, 0, 0.04)",
      elevate2: "rgba(255, 215, 0, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Poiret One', 'Arial', sans-serif",
      body: "'Raleway', 'Helvetica', sans-serif",
    },
    borderRadius: "0rem",
    preview: {
      gradient: "linear-gradient(135deg, #f5f3ef 0%, #e8e4dc 100%)",
      icon: "💎",
    },
  },

  artnouveau: {
    id: "artnouveau",
    name: "Art Nouveau Organic",
    description: "Flowing organic forms with nature-inspired elegance",
    colors: {
      background: "45 30% 94%",
      foreground: "160 30% 18%",
      card: "45 35% 96%",
      cardForeground: "160 30% 18%",
      cardBorder: "160 22% 80%",
      popover: "45 35% 96%",
      popoverForeground: "160 30% 18%",
      popoverBorder: "160 22% 77%",
      primary: "160 45% 30%",
      primaryForeground: "45 35% 96%",
      secondary: "45 25% 85%",
      secondaryForeground: "160 30% 18%",
      accent: "35 65% 42%",
      accentForeground: "160 35% 15%",
      muted: "45 20% 88%",
      mutedForeground: "160 18% 42%",
      destructive: "0 60% 48%",
      destructiveForeground: "45 35% 96%",
      border: "160 18% 80%",
      input: "160 15% 84%",
      ring: "160 45% 30%",
      sidebar: "160 20% 92%",
      sidebarForeground: "160 30% 18%",
      sidebarBorder: "160 18% 82%",
      sidebarPrimary: "160 45% 30%",
      sidebarPrimaryForeground: "45 35% 96%",
      sidebarAccent: "160 16% 87%",
      sidebarAccentForeground: "160 30% 18%",
      sidebarRing: "160 45% 30%",
      chart1: "160 45% 36%",
      chart2: "35 65% 48%",
      chart3: "85 35% 42%",
      chart4: "200 35% 42%",
      chart5: "15 50% 45%",
      buttonOutline: "rgba(55, 100, 85, 0.10)",
      badgeOutline: "rgba(55, 100, 85, 0.05)",
      elevate1: "rgba(55, 100, 85, 0.025)",
      elevate2: "rgba(55, 100, 85, 0.05)",
      shadowColor: "50, 75, 65",
    },
    darkColors: {
      background: "25 30% 10%",
      foreground: "35 35% 90%",
      card: "25 25% 14%",
      cardForeground: "35 35% 90%",
      cardBorder: "25 20% 22%",
      popover: "25 25% 14%",
      popoverForeground: "35 35% 90%",
      popoverBorder: "25 20% 25%",
      primary: "40 75% 55%",
      primaryForeground: "25 30% 10%",
      secondary: "45 25% 25%",
      secondaryForeground: "35 35% 90%",
      accent: "35 60% 40%",
      accentForeground: "35 35% 90%",
      muted: "25 20% 18%",
      mutedForeground: "35 20% 55%",
      destructive: "0 65% 55%",
      destructiveForeground: "35 35% 90%",
      border: "25 20% 20%",
      input: "25 20% 22%",
      ring: "40 75% 55%",
      sidebar: "25 30% 12%",
      sidebarForeground: "35 35% 90%",
      sidebarBorder: "25 20% 18%",
      sidebarPrimary: "40 75% 55%",
      sidebarPrimaryForeground: "25 30% 10%",
      sidebarAccent: "25 20% 18%",
      sidebarAccentForeground: "35 30% 85%",
      sidebarRing: "40 75% 55%",
      chart1: "25 70% 55%",
      chart2: "90 45% 55%",
      chart3: "40 75% 55%",
      chart4: "160 40% 50%",
      chart5: "15 65% 55%",
      buttonOutline: "rgba(184, 134, 11, 0.12)",
      badgeOutline: "rgba(184, 134, 11, 0.06)",
      elevate1: "rgba(184, 134, 11, 0.04)",
      elevate2: "rgba(184, 134, 11, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Tangerine', 'Georgia', cursive",
      body: "'Lora', 'Georgia', serif",
    },
    borderRadius: "1rem",
    preview: {
      gradient: "linear-gradient(135deg, #f4ebe0 0%, #e8dcc8 100%)",
      icon: "🌸",
    },
  },

  gothic: {
    id: "gothic",
    name: "Gothic Mystery",
    description: "Medieval dark romance with purple and candlelit atmosphere",
    colors: {
      background: "40 25% 92%",
      foreground: "280 30% 18%",
      card: "40 30% 95%",
      cardForeground: "280 30% 18%",
      cardBorder: "280 20% 78%",
      popover: "40 30% 95%",
      popoverForeground: "280 30% 18%",
      popoverBorder: "280 20% 75%",
      primary: "280 45% 32%",
      primaryForeground: "40 30% 95%",
      secondary: "40 20% 85%",
      secondaryForeground: "280 30% 18%",
      accent: "350 50% 42%",
      accentForeground: "40 30% 95%",
      muted: "40 18% 88%",
      mutedForeground: "280 18% 40%",
      destructive: "350 65% 48%",
      destructiveForeground: "40 30% 95%",
      border: "280 18% 80%",
      input: "280 15% 84%",
      ring: "280 45% 32%",
      sidebar: "280 18% 91%",
      sidebarForeground: "280 30% 18%",
      sidebarBorder: "280 18% 82%",
      sidebarPrimary: "280 45% 32%",
      sidebarPrimaryForeground: "40 30% 95%",
      sidebarAccent: "280 15% 86%",
      sidebarAccentForeground: "280 30% 18%",
      sidebarRing: "280 45% 32%",
      chart1: "280 45% 38%",
      chart2: "350 50% 45%",
      chart3: "250 35% 40%",
      chart4: "200 40% 42%",
      chart5: "30 60% 45%",
      buttonOutline: "rgba(75, 40, 100, 0.10)",
      badgeOutline: "rgba(75, 40, 100, 0.05)",
      elevate1: "rgba(75, 40, 100, 0.025)",
      elevate2: "rgba(75, 40, 100, 0.05)",
      shadowColor: "60, 35, 75",
    },
    darkColors: {
      background: "280 40% 6%",
      foreground: "280 20% 90%",
      card: "280 35% 10%",
      cardForeground: "280 20% 90%",
      cardBorder: "280 30% 20%",
      popover: "280 35% 10%",
      popoverForeground: "280 20% 90%",
      popoverBorder: "280 30% 22%",
      primary: "280 70% 60%",
      primaryForeground: "280 40% 6%",
      secondary: "280 30% 20%",
      secondaryForeground: "280 20% 90%",
      accent: "300 60% 50%",
      accentForeground: "280 20% 90%",
      muted: "280 25% 15%",
      mutedForeground: "280 15% 55%",
      destructive: "350 70% 55%",
      destructiveForeground: "280 20% 90%",
      border: "280 25% 18%",
      input: "280 25% 20%",
      ring: "280 70% 60%",
      sidebar: "280 40% 8%",
      sidebarForeground: "280 20% 90%",
      sidebarBorder: "280 25% 15%",
      sidebarPrimary: "280 70% 60%",
      sidebarPrimaryForeground: "280 40% 6%",
      sidebarAccent: "280 30% 15%",
      sidebarAccentForeground: "280 15% 85%",
      sidebarRing: "280 70% 60%",
      chart1: "280 70% 65%",
      chart2: "330 55% 60%",
      chart3: "250 55% 60%",
      chart4: "300 55% 60%",
      chart5: "200 45% 55%",
      buttonOutline: "rgba(216, 160, 216, 0.12)",
      badgeOutline: "rgba(216, 160, 216, 0.06)",
      elevate1: "rgba(216, 160, 216, 0.04)",
      elevate2: "rgba(216, 160, 216, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Cinzel Decorative', 'Georgia', serif",
      body: "'Crimson Text', 'Georgia', serif",
    },
    borderRadius: "0.5rem",
    preview: {
      gradient: "linear-gradient(135deg, #f0ebe6 0%, #e4dcd2 100%)",
      icon: "🦇",
    },
  },

  darkacademia: {
    id: "darkacademia",
    name: "Dark Academia Magic",
    description: "Scholarly mysticism with aged leather and candlelight",
    colors: {
      background: "35 30% 92%",
      foreground: "25 35% 18%",
      card: "38 35% 95%",
      cardForeground: "25 35% 18%",
      cardBorder: "25 25% 78%",
      popover: "38 35% 95%",
      popoverForeground: "25 35% 18%",
      popoverBorder: "25 25% 75%",
      primary: "25 55% 30%",
      primaryForeground: "38 35% 95%",
      secondary: "35 25% 85%",
      secondaryForeground: "25 35% 18%",
      accent: "140 35% 35%",
      accentForeground: "38 35% 95%",
      muted: "35 20% 87%",
      mutedForeground: "25 20% 40%",
      destructive: "0 60% 48%",
      destructiveForeground: "38 35% 95%",
      border: "25 22% 78%",
      input: "25 20% 82%",
      ring: "25 55% 30%",
      sidebar: "25 25% 90%",
      sidebarForeground: "25 35% 18%",
      sidebarBorder: "25 20% 80%",
      sidebarPrimary: "25 55% 30%",
      sidebarPrimaryForeground: "38 35% 95%",
      sidebarAccent: "25 20% 85%",
      sidebarAccentForeground: "25 35% 18%",
      sidebarRing: "25 55% 30%",
      chart1: "25 55% 35%",
      chart2: "140 35% 40%",
      chart3: "45 60% 45%",
      chart4: "15 45% 40%",
      chart5: "200 30% 40%",
      buttonOutline: "rgba(100, 65, 40, 0.10)",
      badgeOutline: "rgba(100, 65, 40, 0.05)",
      elevate1: "rgba(100, 65, 40, 0.025)",
      elevate2: "rgba(100, 65, 40, 0.05)",
      shadowColor: "80, 55, 40",
    },
    darkColors: {
      background: "30 25% 8%",
      foreground: "35 25% 88%",
      card: "30 20% 12%",
      cardForeground: "35 25% 88%",
      cardBorder: "30 18% 20%",
      popover: "30 20% 12%",
      popoverForeground: "35 25% 88%",
      popoverBorder: "30 18% 22%",
      primary: "45 80% 55%",
      primaryForeground: "30 25% 8%",
      secondary: "30 18% 22%",
      secondaryForeground: "35 25% 88%",
      accent: "40 65% 45%",
      accentForeground: "35 25% 88%",
      muted: "30 15% 16%",
      mutedForeground: "35 15% 55%",
      destructive: "0 65% 55%",
      destructiveForeground: "35 25% 88%",
      border: "30 15% 18%",
      input: "30 15% 20%",
      ring: "45 80% 55%",
      sidebar: "30 25% 10%",
      sidebarForeground: "35 25% 88%",
      sidebarBorder: "30 15% 16%",
      sidebarPrimary: "45 80% 55%",
      sidebarPrimaryForeground: "30 25% 8%",
      sidebarAccent: "30 18% 16%",
      sidebarAccentForeground: "35 20% 82%",
      sidebarRing: "45 80% 55%",
      chart1: "45 80% 60%",
      chart2: "20 55% 55%",
      chart3: "60 45% 55%",
      chart4: "30 65% 55%",
      chart5: "80 40% 55%",
      buttonOutline: "rgba(201, 169, 97, 0.12)",
      badgeOutline: "rgba(201, 169, 97, 0.06)",
      elevate1: "rgba(201, 169, 97, 0.04)",
      elevate2: "rgba(201, 169, 97, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Spectral', 'Georgia', serif",
      body: "'Source Serif Pro', 'Georgia', serif",
    },
    borderRadius: "0.375rem",
    preview: {
      gradient: "linear-gradient(135deg, #f4ede4 0%, #e8ddd0 100%)",
      icon: "📚",
    },
  },

  baroquerefined: {
    id: "baroquerefined",
    name: "Baroque Refined",
    description: "Sophisticated baroque with deep burgundy and burnished gold",
    colors: {
      background: "30 30% 93%",
      foreground: "350 40% 16%",
      card: "32 35% 96%",
      cardForeground: "350 40% 16%",
      cardBorder: "350 25% 80%",
      popover: "32 35% 96%",
      popoverForeground: "350 40% 16%",
      popoverBorder: "350 25% 77%",
      primary: "350 50% 32%",
      primaryForeground: "32 35% 96%",
      secondary: "30 25% 86%",
      secondaryForeground: "350 40% 16%",
      accent: "45 80% 42%",
      accentForeground: "350 45% 14%",
      muted: "30 20% 88%",
      mutedForeground: "350 20% 40%",
      destructive: "0 65% 48%",
      destructiveForeground: "32 35% 96%",
      border: "350 22% 82%",
      input: "350 18% 85%",
      ring: "350 50% 32%",
      sidebar: "350 22% 91%",
      sidebarForeground: "350 40% 16%",
      sidebarBorder: "350 20% 83%",
      sidebarPrimary: "350 50% 32%",
      sidebarPrimaryForeground: "32 35% 96%",
      sidebarAccent: "350 18% 87%",
      sidebarAccentForeground: "350 40% 16%",
      sidebarRing: "350 50% 32%",
      chart1: "350 50% 38%",
      chart2: "45 80% 48%",
      chart3: "20 55% 42%",
      chart4: "330 40% 42%",
      chart5: "10 50% 42%",
      buttonOutline: "rgba(120, 45, 60, 0.10)",
      badgeOutline: "rgba(120, 45, 60, 0.05)",
      elevate1: "rgba(120, 45, 60, 0.025)",
      elevate2: "rgba(120, 45, 60, 0.05)",
      shadowColor: "95, 40, 55",
    },
    darkColors: {
      background: "10 25% 6%",
      foreground: "25 25% 90%",
      card: "10 22% 10%",
      cardForeground: "25 25% 90%",
      cardBorder: "45 50% 22%",
      popover: "10 22% 10%",
      popoverForeground: "25 25% 90%",
      popoverBorder: "45 50% 25%",
      primary: "45 90% 52%",
      primaryForeground: "10 25% 6%",
      secondary: "10 20% 18%",
      secondaryForeground: "25 25% 90%",
      accent: "40 75% 42%",
      accentForeground: "25 25% 90%",
      muted: "10 18% 14%",
      mutedForeground: "25 15% 55%",
      destructive: "350 70% 55%",
      destructiveForeground: "25 25% 90%",
      border: "45 40% 18%",
      input: "45 40% 20%",
      ring: "45 90% 52%",
      sidebar: "10 25% 8%",
      sidebarForeground: "25 25% 90%",
      sidebarBorder: "45 40% 15%",
      sidebarPrimary: "45 90% 52%",
      sidebarPrimaryForeground: "10 25% 6%",
      sidebarAccent: "10 20% 14%",
      sidebarAccentForeground: "25 20% 85%",
      sidebarRing: "45 90% 52%",
      chart1: "45 90% 58%",
      chart2: "350 60% 58%",
      chart3: "20 75% 55%",
      chart4: "40 85% 60%",
      chart5: "10 55% 55%",
      buttonOutline: "rgba(212, 175, 55, 0.12)",
      badgeOutline: "rgba(212, 175, 55, 0.06)",
      elevate1: "rgba(212, 175, 55, 0.04)",
      elevate2: "rgba(212, 175, 55, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Playfair Display', 'Georgia', serif",
      body: "'Cormorant', 'Garamond', serif",
    },
    borderRadius: "0.375rem",
    preview: {
      gradient: "linear-gradient(135deg, #f6f0ea 0%, #ebe3d8 100%)",
      icon: "🎭",
    },
  },

  cottagecorevintage: {
    id: "cottagecorevintage",
    name: "Cottagecore Vintage",
    description: "Nostalgic storybook charm with sage and antique ivory",
    colors: {
      background: "50 30% 95%",
      foreground: "30 25% 20%",
      card: "50 35% 98%",
      cardForeground: "30 25% 20%",
      cardBorder: "50 20% 85%",
      popover: "50 35% 98%",
      popoverForeground: "30 25% 20%",
      popoverBorder: "50 20% 82%",
      primary: "95 35% 42%",
      primaryForeground: "50 35% 98%",
      secondary: "45 25% 82%",
      secondaryForeground: "30 25% 20%",
      accent: "85 40% 50%",
      accentForeground: "50 35% 98%",
      muted: "50 20% 88%",
      mutedForeground: "30 15% 42%",
      destructive: "0 60% 50%",
      destructiveForeground: "50 35% 98%",
      border: "50 18% 80%",
      input: "50 18% 85%",
      ring: "95 35% 42%",
      sidebar: "50 28% 92%",
      sidebarForeground: "30 25% 20%",
      sidebarBorder: "50 18% 82%",
      sidebarPrimary: "95 35% 42%",
      sidebarPrimaryForeground: "50 35% 98%",
      sidebarAccent: "85 30% 85%",
      sidebarAccentForeground: "30 25% 20%",
      sidebarRing: "95 35% 42%",
      chart1: "95 35% 45%",
      chart2: "30 50% 50%",
      chart3: "85 40% 50%",
      chart4: "45 55% 55%",
      chart5: "120 30% 45%",
      buttonOutline: "rgba(122, 157, 84, 0.10)",
      badgeOutline: "rgba(122, 157, 84, 0.05)",
      elevate1: "rgba(122, 157, 84, 0.025)",
      elevate2: "rgba(122, 157, 84, 0.05)",
      shadowColor: "93, 78, 55",
    },
    darkColors: {
      background: "30 20% 10%",
      foreground: "50 30% 88%",
      card: "30 18% 14%",
      cardForeground: "50 30% 88%",
      cardBorder: "30 15% 22%",
      popover: "30 18% 14%",
      popoverForeground: "50 30% 88%",
      popoverBorder: "30 15% 25%",
      primary: "95 45% 55%",
      primaryForeground: "30 20% 10%",
      secondary: "45 18% 25%",
      secondaryForeground: "50 30% 88%",
      accent: "85 45% 42%",
      accentForeground: "50 30% 88%",
      muted: "30 12% 18%",
      mutedForeground: "50 15% 55%",
      destructive: "0 60% 55%",
      destructiveForeground: "50 30% 88%",
      border: "30 12% 20%",
      input: "30 12% 22%",
      ring: "95 45% 55%",
      sidebar: "30 20% 12%",
      sidebarForeground: "50 30% 88%",
      sidebarBorder: "30 12% 18%",
      sidebarPrimary: "95 45% 55%",
      sidebarPrimaryForeground: "30 20% 10%",
      sidebarAccent: "30 15% 18%",
      sidebarAccentForeground: "50 25% 82%",
      sidebarRing: "95 45% 55%",
      chart1: "95 45% 60%",
      chart2: "30 55% 55%",
      chart3: "85 45% 55%",
      chart4: "45 60% 60%",
      chart5: "120 35% 55%",
      buttonOutline: "rgba(122, 157, 84, 0.12)",
      badgeOutline: "rgba(122, 157, 84, 0.06)",
      elevate1: "rgba(122, 157, 84, 0.04)",
      elevate2: "rgba(122, 157, 84, 0.08)",
      shadowColor: "0, 0, 0",
    },
    fonts: {
      heading: "'Vollkorn', 'Georgia', serif",
      body: "'Nunito', 'Trebuchet MS', sans-serif",
    },
    borderRadius: "1rem",
    preview: {
      gradient: "linear-gradient(135deg, #faf6ee 0%, #f0ebe0 100%)",
      icon: "🌼",
    },
  },
};

export const defaultTheme = "cottagecore";

export function getTheme(themeId: string): Theme {
  return themes[themeId] || themes[defaultTheme];
}

export function getThemeForegroundColor(themeId: string): string {
  const theme = themes[themeId];
  if (!theme) return `hsl(${themes[defaultTheme].colors.foreground})`;
  return `hsl(${theme.colors.foreground})`;
}

function generateShadows(shadowColor: string, isLight: boolean): string {
  if (isLight) {
    return `
    --shadow-2xs: 0px 1px 2px 0px rgba(${shadowColor}, 0.04);
    --shadow-xs: 0px 1px 3px 0px rgba(${shadowColor}, 0.08);
    --shadow-sm: 0px 2px 4px -1px rgba(${shadowColor}, 0.08), 0px 1px 2px -1px rgba(${shadowColor}, 0.05);
    --shadow: 0px 4px 6px -1px rgba(${shadowColor}, 0.10), 0px 2px 4px -2px rgba(${shadowColor}, 0.06);
    --shadow-md: 0px 6px 10px -2px rgba(${shadowColor}, 0.12), 0px 2px 6px -2px rgba(${shadowColor}, 0.06);
    --shadow-lg: 0px 12px 16px -4px rgba(${shadowColor}, 0.14), 0px 4px 6px -2px rgba(${shadowColor}, 0.08);
    --shadow-xl: 0px 20px 25px -5px rgba(${shadowColor}, 0.16), 0px 8px 10px -6px rgba(${shadowColor}, 0.10);
    --shadow-2xl: 0px 25px 50px -12px rgba(${shadowColor}, 0.20);`;
  } else {
    return `
    --shadow-2xs: 0px 1px 2px 0px rgba(0, 0, 0, 0.5);
    --shadow-xs: 0px 1px 3px 0px rgba(0, 0, 0, 0.6);
    --shadow-sm: 0px 2px 4px -1px rgba(0, 0, 0, 0.6), 0px 1px 2px -1px rgba(0, 0, 0, 0.4);
    --shadow: 0px 4px 6px -1px rgba(0, 0, 0, 0.7), 0px 2px 4px -2px rgba(0, 0, 0, 0.5);
    --shadow-md: 0px 6px 10px -2px rgba(0, 0, 0, 0.75), 0px 2px 6px -2px rgba(0, 0, 0, 0.6);
    --shadow-lg: 0px 12px 16px -4px rgba(0, 0, 0, 0.8), 0px 4px 6px -2px rgba(0, 0, 0, 0.7);
    --shadow-xl: 0px 20px 25px -5px rgba(0, 0, 0, 0.85), 0px 8px 10px -6px rgba(0, 0, 0, 0.75);
    --shadow-2xl: 0px 25px 50px -12px rgba(0, 0, 0, 0.9);`;
  }
}

function generateColorVariables(colors: ThemeColors, isLight: boolean): string {
  const vars: string[] = [];
  
  vars.push(`--background: ${colors.background};`);
  vars.push(`--foreground: ${colors.foreground};`);
  vars.push(`--card: ${colors.card};`);
  vars.push(`--card-foreground: ${colors.cardForeground};`);
  vars.push(`--card-border: ${colors.cardBorder};`);
  vars.push(`--popover: ${colors.popover};`);
  vars.push(`--popover-foreground: ${colors.popoverForeground};`);
  vars.push(`--popover-border: ${colors.popoverBorder};`);
  vars.push(`--primary: ${colors.primary};`);
  vars.push(`--primary-foreground: ${colors.primaryForeground};`);
  vars.push(`--secondary: ${colors.secondary};`);
  vars.push(`--secondary-foreground: ${colors.secondaryForeground};`);
  vars.push(`--accent: ${colors.accent};`);
  vars.push(`--accent-foreground: ${colors.accentForeground};`);
  vars.push(`--muted: ${colors.muted};`);
  vars.push(`--muted-foreground: ${colors.mutedForeground};`);
  vars.push(`--destructive: ${colors.destructive};`);
  vars.push(`--destructive-foreground: ${colors.destructiveForeground};`);
  vars.push(`--border: ${colors.border};`);
  vars.push(`--input: ${colors.input};`);
  vars.push(`--ring: ${colors.ring};`);
  vars.push(`--sidebar: ${colors.sidebar};`);
  vars.push(`--sidebar-foreground: ${colors.sidebarForeground};`);
  vars.push(`--sidebar-border: ${colors.sidebarBorder};`);
  vars.push(`--sidebar-primary: ${colors.sidebarPrimary};`);
  vars.push(`--sidebar-primary-foreground: ${colors.sidebarPrimaryForeground};`);
  vars.push(`--sidebar-accent: ${colors.sidebarAccent};`);
  vars.push(`--sidebar-accent-foreground: ${colors.sidebarAccentForeground};`);
  vars.push(`--sidebar-ring: ${colors.sidebarRing};`);
  vars.push(`--chart-1: ${colors.chart1};`);
  vars.push(`--chart-2: ${colors.chart2};`);
  vars.push(`--chart-3: ${colors.chart3};`);
  vars.push(`--chart-4: ${colors.chart4};`);
  vars.push(`--chart-5: ${colors.chart5};`);
  vars.push(`--button-outline: ${colors.buttonOutline};`);
  vars.push(`--badge-outline: ${colors.badgeOutline};`);
  vars.push(`--elevate-1: ${colors.elevate1};`);
  vars.push(`--elevate-2: ${colors.elevate2};`);
  vars.push(`--opaque-button-border-intensity: ${isLight ? '-6' : '8'};`);
  vars.push(generateShadows(colors.shadowColor, isLight));
  
  return vars.join("\n    ");
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;

  const existingStyleId = "luma-theme-styles";
  let styleEl = document.getElementById(existingStyleId) as HTMLStyleElement | null;
  
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = existingStyleId;
    document.head.appendChild(styleEl);
  }

  const lightVars = generateColorVariables(theme.colors, true);
  const darkVars = generateColorVariables(theme.darkColors, false);

  styleEl.textContent = `
  html:root {
    ${lightVars}
    --font-sans: ${theme.fonts.body};
    --font-serif: ${theme.fonts.heading};
    --font-mono: "JetBrains Mono", Consolas, monospace;
    --radius: ${theme.borderRadius};
    --tracking-normal: -0.01em;
    --spacing: 0.25rem;
  }
  
  html.dark {
    ${darkVars}
  }
  `;
  
  root.setAttribute("data-theme", theme.id);
}
