export type DeveloperConfig = {
  contentPath: string;
  apiBase: string;
  staticStudioEnabled: boolean;
  setupPath: string;
  adminPath: string;
};

/**
 * Developer-facing defaults. Most users should use the first-run setup studio
 * and the admin panel instead of editing this file.
 */
export const developerConfig: DeveloperConfig = {
  contentPath: "./myhome.json",
  apiBase: "/api",
  staticStudioEnabled: true,
  setupPath: "/setup",
  adminPath: "/admin",
};
