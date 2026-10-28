const path = require("path");

// The one .env lives at the project root, next to backend/ and frontend/.
// Next.js only reads .env from its own folder, so load the root one here.
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
