import type { MetadataRoute } from "next";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    start_url: "/inbox",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#14201B",
    icons: [
      { src: "/brand/fundfellows-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/fundfellows-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
