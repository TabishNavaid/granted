import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge covers the sidebar footer and lands in screenshots.
  devIndicators: false,
  // Landing screenshots are UI text; 90 keeps it crisp. 75 is the default for everything else.
  images: { qualities: [75, 90] },
  // pdf-parse and cheerio run on the server only and should not be bundled.
  serverExternalPackages: ["pdf-parse"],
  async redirects() {
    return [{ source: "/pricing", destination: "/free", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
