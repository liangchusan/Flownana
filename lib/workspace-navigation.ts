export const WORKSPACE_PATHS = {
  home: "/",
  image: "/image",
  video: "/video",
  assets: "/assets",
} as const;

export type WorkspaceDestination = keyof typeof WORKSPACE_PATHS;
export type WorkspaceCreationDestination = Extract<WorkspaceDestination, "image" | "video">;

export function getWorkspaceDestination(pathname: string): WorkspaceDestination | null {
  const entry = Object.entries(WORKSPACE_PATHS).find(([, path]) => path === pathname);
  return entry ? entry[0] as WorkspaceDestination : null;
}
