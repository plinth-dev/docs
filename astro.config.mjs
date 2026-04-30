// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

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
        { icon: "github", label: "GitHub", href: "https://github.com/plinth-dev" },
      ],
      editLink: {
        baseUrl: "https://github.com/plinth-dev/docs/edit/main/",
      },
      lastUpdated: true,
      head: [
        {
          tag: "meta",
          attrs: { property: "og:image", content: "/og.png" },
        },
      ],
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
