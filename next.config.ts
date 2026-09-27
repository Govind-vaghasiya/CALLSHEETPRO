import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdf-parse', 'pdfjs-dist'],
  experimental: {
    serverActions: {
      // Script PDFs are uploaded through a server action (default limit is 1 MB).
      // Netlify caps a request at ~6 MB, so stay under that.
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
