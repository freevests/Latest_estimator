import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "./db";
import type { CloudFile } from "./dropbox";

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.ONEDRIVE_CLIENT_ID || "",
    clientSecret: process.env.ONEDRIVE_CLIENT_SECRET || "",
    authority: `https://login.microsoftonline.com/${process.env.ONEDRIVE_TENANT_ID || "common"}`,
  },
};

export function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication(msalConfig);
}

export function getAuthUrl(msalClient: ConfidentialClientApplication): Promise<string> {
  return msalClient.getAuthCodeUrl({
    scopes: ["Files.Read", "Files.Read.All", "User.Read"],
    redirectUri: process.env.ONEDRIVE_REDIRECT_URI!,
  });
}

export async function getGraphClient(): Promise<Client | null> {
  const token = await prisma.cloudToken.findUnique({
    where: { provider: "onedrive" },
  });
  if (!token) return null;

  // Check expiry and refresh
  if (token.expiresAt && token.expiresAt < new Date() && token.refreshToken) {
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByRefreshToken({
      refreshToken: token.refreshToken,
      scopes: ["Files.Read", "Files.Read.All", "User.Read"],
    });

    if (result) {
      await prisma.cloudToken.update({
        where: { provider: "onedrive" },
        data: {
          accessToken: result.accessToken,
          expiresAt: result.expiresOn || undefined,
        },
      });

      return Client.init({
        authProvider: (done) => done(null, result.accessToken),
      });
    }
    return null;
  }

  return Client.init({
    authProvider: (done) => done(null, token.accessToken),
  });
}

interface GraphDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size?: number;
  lastModifiedDateTime?: string;
  parentReference?: { path?: string };
}

export function mapOneDriveEntries(items: GraphDriveItem[]): CloudFile[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    path: item.parentReference?.path
      ? `${item.parentReference.path}/${item.name}`
      : `/${item.name}`,
    isFolder: !!item.folder,
    size: item.size,
    modified: item.lastModifiedDateTime,
  }));
}
