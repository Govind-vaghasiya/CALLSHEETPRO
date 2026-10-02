import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdf-parse', 'pdfjs-dist'],
  // pdf-parse's bundled pdfjs loads its worker with a runtime import() that file
  // tracing can't follow, so serverless bundles (Netlify) would ship without it.
  outputFileTracingIncludes: {
    '/**': ['./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs'],
  },
  experimental: {
    serverActions: {
      // Script PDFs are uploaded through a server action (default limit is 1 MB).
      // Netlify caps a request at ~6 MB, so stay under that.
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
