import type { NextConfig } from "next";

/**
 * NoteSmith is a static site: `next build` writes plain files to `out/`,
 * served by GitHub Pages (or any static host). There is no server.
 * NOTESMITH_BASE_PATH is the folder it's served from, e.g. "/NoteSmith"
 * for https://<user>.github.io/NoteSmith/. Leave it unset to serve at the root.
 */
const basePath = process.env.NOTESMITH_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: { appIsrStatus: false, buildActivity: false },
};

export default nextConfig;
