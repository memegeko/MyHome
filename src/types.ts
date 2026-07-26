export type MediaRef = {
  src: string;
  alt: string;
  credit: string;
  sourceUrl: string;
};

export type SocialLink = {
  id: string;
  label: string;
  url: string;
  icon: string;
  private?: boolean;
  privatePlaceholder?: string;
};

export type Profile = {
  displayName: string;
  username: string;
  tagline: string;
  status: string;
  bio: string;
  avatar: MediaRef;
};

export type PageDefinition = {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  private?: boolean;
  privatePlaceholder?: string;
};

export type ProjectItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  url: string;
  sourceUrl: string;
  tags: string[];
  cover: MediaRef;
};

export type RecordItem = {
  id: string;
  title: string;
  artist: string;
  spotifyUrl: string;
  sampleUrl: string;
  cover: MediaRef;
};

export type AnimeItem = {
  id: string;
  title: string;
  status: "planned" | "watching" | "completed" | "paused" | "dropped";
  currentSeason: number | null;
  currentEpisode: number | null;
  watchedSeasons: number[];
  totalSeasons: number | null;
  totalEpisodes: number | null;
  notes: string;
  cover: MediaRef;
};

export type GalleryItem = {
  id: string;
  title: string;
  caption: string;
  image: MediaRef;
};

export type DirectoryItem = {
  id: string;
  name: string;
  description: string;
  url: string;
  image: MediaRef;
};

export type BlockType =
  | "about"
  | "projects"
  | "records"
  | "anime"
  | "gallery"
  | "people"
  | "places"
  | "custom";

type BlockBase = {
  id: string;
  type: BlockType;
  pageId: string;
  title: string;
  icon: string;
  enabled: boolean;
  private?: boolean;
  privatePlaceholder?: string;
  style?: Partial<BlockStyleSettings>;
};

export type BlockStyleSettings = {
  accent: string;
  background: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  padding: number;
  fontFamily: string;
};

export type AboutBlock = BlockBase & {
  type: "about";
  body: string;
};

export type ProjectsBlock = BlockBase & {
  type: "projects";
  items: ProjectItem[];
};

export type RecordsBlock = BlockBase & {
  type: "records";
  items: RecordItem[];
};

export type AnimeBlock = BlockBase & {
  type: "anime";
  items: AnimeItem[];
};

export type GalleryBlock = BlockBase & {
  type: "gallery";
  items: GalleryItem[];
};

export type DirectoryBlock = BlockBase & {
  type: "people" | "places";
  items: DirectoryItem[];
};

export type CustomBlock = BlockBase & {
  type: "custom";
  body: string;
  image: MediaRef;
  linkLabel: string;
  linkUrl: string;
};

export type ContentBlock =
  | AboutBlock
  | ProjectsBlock
  | RecordsBlock
  | AnimeBlock
  | GalleryBlock
  | DirectoryBlock
  | CustomBlock;

export type AppearanceSettings = {
  themeId: string;
  accent: string;
  background: MediaRef;
  backgroundMode: "cover" | "contain" | "tile" | "stretch";
  backgroundPosition: "center" | "top" | "bottom" | "left" | "right";
  animationsEnabled: boolean;
  animationIntensity: number;
  animationSpeed: number;
  animationEasing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  particleType: "bubbles" | "sparkles" | "snow" | "none";
  particleAmount: number;
  particleSize: number;
  particleDirection: "up" | "down" | "left" | "right";
  fontFamily: string;
  headingFontFamily: string;
  textColor: string;
  panelColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  contentSpacing: number;
  pageStyles: Record<string, Partial<BlockStyleSettings>>;
};

export type SiteDocument = {
  formatVersion: 1;
  configured: boolean;
  siteTitle: string;
  siteSubtitle: string;
  profile: Profile;
  socials: SocialLink[];
  pages: PageDefinition[];
  blocks: ContentBlock[];
  appearance: AppearanceSettings;
  updatedAt: string;
};

export type ThemePreset = {
  format: "myhome-theme";
  version: 1;
  name: string;
  description: string;
  appearance: AppearanceSettings;
};

export type StaticSessionPreference =
  | "always"
  | "session"
  | "until-logout";

export type OwnerEnvelope = {
  format: "myhome-owner";
  version: 1;
  email: string;
  sessionPreference: StaticSessionPreference;
  password: {
    salt: string;
    iv: string;
    ciphertext: string;
  };
  recovery: {
    salt: string;
    iv: string;
    ciphertext: string;
  };
  updatedAt: string;
};

export type RuntimeMode = "static" | "server";
