import type { App } from "@calcom/types/App";

export function getAppAssetFullPath(assetPath: string | undefined, metadata: Pick<App, "dirName" | "isTemplate">) {
  if (!assetPath || typeof assetPath !== "string") {
    return "";
  }
  const appDirName = `${metadata.isTemplate ? "templates/" : ""}${metadata.dirName}`;
  let assetFullPath = assetPath;
  if (!assetPath.startsWith("/app-store/") && !/^https?/.test(assetPath)) {
    assetFullPath = `/app-store/${appDirName}/${assetPath}`;
  }
  return assetFullPath;
}
