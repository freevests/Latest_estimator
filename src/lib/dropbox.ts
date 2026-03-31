import { Dropbox, DropboxAuth } from "dropbox";
import { prisma } from "./db";

export function getDropboxAuth(): DropboxAuth {
  return new DropboxAuth({
    clientId: process.env.DROPBOX_APP_KEY!,
    clientSecret: process.env.DROPBOX_APP_SECRET!,
  });
}

export async function getDropboxClient(): Promise<Dropbox | null> {
  const token = await prisma.cloudToken.findUnique({
    where: { provider: "dropbox" },
  });
  if (!token) return null;

  // Check if token is expired and refresh if needed
  if (token.expiresAt && token.expiresAt < new Date() && token.refreshToken) {
    const auth = getDropboxAuth();
    auth.setRefreshToken(token.refreshToken);
    const response = await auth.refreshAccessToken();
    const newToken = auth.getAccessToken();

    await prisma.cloudToken.update({
      where: { provider: "dropbox" },
      data: {
        accessToken: newToken,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // ~4 hours
      },
    });

    return new Dropbox({ accessToken: newToken });
  }

  return new Dropbox({ accessToken: token.accessToken });
}

export interface CloudFile {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size?: number;
  modified?: string;
}

export function mapDropboxEntries(entries: Array<{ ".tag": string; name: string; path_lower?: string; path_display?: string; size?: number; server_modified?: string; id?: string }>): CloudFile[] {
  return entries
    .filter((e) => e[".tag"] === "file" || e[".tag"] === "folder")
    .map((entry) => ({
      id: entry.id || entry.path_lower || entry.name,
      name: entry.name,
      path: entry.path_display || entry.path_lower || "",
      isFolder: entry[".tag"] === "folder",
      size: entry.size,
      modified: entry.server_modified,
    }));
}
