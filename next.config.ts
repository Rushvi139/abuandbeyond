import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted: build a standalone Node server for the Docker image (see Dockerfile, docs/deploy.md).
  output: "standalone",
};

export default nextConfig;
