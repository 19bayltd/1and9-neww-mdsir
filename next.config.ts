import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Hosts that appear in image_library.image_url. next/image refuses
    // unlisted hosts — add new entries here when new image CDNs are added
    // to the image library.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.1and9apparel.com" },
    ],
  },
};

export default nextConfig;
