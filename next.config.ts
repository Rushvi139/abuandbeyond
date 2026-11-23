import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted: build a standalone Node server for the Docker image (see Dockerfile, docs/deploy.md).
  output: "standalone",
  experimental: {
    // Forms that carry photos (banners, dishes, recipes, expenses, the daily
    // book) post through server actions, whose default cap is 1 MB: a single
    // phone photo is 2-5 MB. Each file is still checked (8-15 MB) in lib/files.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
