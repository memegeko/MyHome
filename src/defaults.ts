import type {
  AppearanceSettings,
  ContentBlock,
  MediaRef,
  PageDefinition,
  SiteDocument,
  ThemePreset,
} from "./types";

export const emptyMedia = (): MediaRef => ({
  src: "",
  alt: "",
  credit: "",
  sourceUrl: "",
});

export const defaultPages = (): PageDefinition[] => [
  { id: "home", label: "Home", icon: "⌂", enabled: true },
  { id: "projects", label: "Projects", icon: "▦", enabled: false },
  { id: "records", label: "Records", icon: "♫", enabled: false },
  { id: "anime", label: "Anime", icon: "★", enabled: false },
  { id: "gallery", label: "Gallery", icon: "▧", enabled: false },
  { id: "links", label: "Links", icon: "☻", enabled: false },
];

export const defaultBlocks = (): ContentBlock[] => [
  {
    id: "about",
    type: "about",
    pageId: "home",
    title: "About me",
    icon: "☺",
    enabled: true,
    body: "",
  },
  {
    id: "projects",
    type: "projects",
    pageId: "projects",
    title: "Projects",
    icon: "▦",
    enabled: true,
    items: [],
  },
  {
    id: "records",
    type: "records",
    pageId: "records",
    title: "Record shelf",
    icon: "♫",
    enabled: true,
    items: [],
  },
  {
    id: "anime",
    type: "anime",
    pageId: "anime",
    title: "Anime list",
    icon: "★",
    enabled: true,
    items: [],
  },
  {
    id: "gallery",
    type: "gallery",
    pageId: "gallery",
    title: "Gallery",
    icon: "▧",
    enabled: true,
    items: [],
  },
  {
    id: "people",
    type: "people",
    pageId: "links",
    title: "Cool people",
    icon: "☻",
    enabled: true,
    items: [],
  },
  {
    id: "places",
    type: "places",
    pageId: "links",
    title: "Cool places",
    icon: "⌖",
    enabled: true,
    items: [],
  },
];

export const aeroAppearance = (): AppearanceSettings => ({
  themeId: "aero-glass",
  accent: "#24c8c0",
  background: emptyMedia(),
  backgroundMode: "cover",
  backgroundPosition: "center",
  animationsEnabled: true,
  animationIntensity: 55,
});

export function createBlankDocument(): SiteDocument {
  return {
    formatVersion: 1,
    configured: false,
    siteTitle: "MyHome",
    siteSubtitle: "",
    profile: {
      displayName: "",
      username: "",
      tagline: "",
      status: "",
      bio: "",
      avatar: emptyMedia(),
    },
    socials: [],
    pages: defaultPages(),
    blocks: defaultBlocks(),
    appearance: aeroAppearance(),
    updatedAt: "",
  };
}

export const aeroThemePreset: ThemePreset = {
  format: "myhome-theme",
  version: 1,
  name: "Aero Glass",
  description:
    "A bright glass-and-sky preset built entirely from CSS, with no personal text or copyrighted images.",
  appearance: aeroAppearance(),
};
