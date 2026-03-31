import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@tus/server", "@tus/file-store", "exceljs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
