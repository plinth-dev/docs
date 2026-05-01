// @ts-check

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
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: false,
      },
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
      // OG image lands in Phase F — until then no og:image meta is set
      // (better than a 404'd image). Re-enable when /og.png ships.
      head: [],
      customCss: ["./src/assets/theme.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What is Plinth", slug: "index" },
            { label: "Manifesto", slug: "manifesto" },
            { label: "Try it in 60 minutes", slug: "start/try-it" },
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
          label: "Decisions (ADRs)",
          autogenerate: { directory: "adr" },
        },
      ],
    }),
  ],
});
