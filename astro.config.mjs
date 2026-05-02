// @ts-check

import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://plinth.run",
  trailingSlash: "ignore",
  integrations: [
    starlight({
      title: "Plinth",
      description:
        "Open-source platform foundation for enterprise teams running fleets of internal-tooling modules.",
      // Wordmark only — "Plinth" in IBM Plex Sans reads as a logo of its own.
      // (No image logo file; Starlight falls back to the title text.)
      favicon: "/favicon.svg",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/plinth-dev",
        },
      ],
      editLink: {
        baseUrl: "https://github.com/plinth-dev/docs/edit/main/",
      },
      lastUpdated: true,
      head: [
        {
          tag: "meta",
          attrs: { name: "theme-color", content: "#FBFBF9" },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://plinth.run/og-default.png",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:width", content: "1200" },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:height", content: "630" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://plinth.run/og-default.png",
          },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: true,
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap",
          },
        },
      ],
      customCss: ["./src/assets/theme.css"],
      components: {
        Hero: "./src/components/Hero.astro",
      },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What is Plinth", slug: "index" },
            { label: "Manifesto", slug: "manifesto" },
            { label: "Stand it up", slug: "start/try-it" },
            {
              label: "v0.1.0 launch",
              slug: "launch/v0-1-0",
              badge: { text: "new", variant: "tip" },
            },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "Overview", slug: "architecture" },
            { label: "Interactive explorer", link: "/explorer.html" },
          ],
        },
        {
          label: "SDK design",
          autogenerate: { directory: "sdk" },
        },
        {
          label: "Examples",
          autogenerate: { directory: "examples" },
        },
        {
          label: "Tools",
          badge: { text: "new", variant: "tip" },
          items: [
            {
              label: "Sketch",
              slug: "tools/sketch",
              badge: { text: "live", variant: "success" },
            },
            { label: "All tools", slug: "tools" },
          ],
        },
        {
          label: "Decisions (ADRs)",
          autogenerate: { directory: "adr" },
        },
      ],
    }),
    mdx(),
  ],
});
