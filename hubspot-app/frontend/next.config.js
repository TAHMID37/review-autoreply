const path = require("path");

// The one .env lives at the project root, next to backend/ and frontend/.
// Next.js only reads .env from its own folder, so load the root one here.
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard does not use next/image; turning the optimizer off removes a whole class of server-side image attacks.
  images: { unoptimized: true },
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DEV_LOGIN: process.env.NEXT_PUBLIC_DEV_LOGIN,
  },
};

module.exports = nextConfig;
