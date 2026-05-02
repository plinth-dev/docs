---
title: Tools
description: Free utilities for working with Plinth and the adjacent stacks Plinth integrates — Cerbos, OpenTelemetry, CloudEvents, Helm, RFC 7807. No signup, no tracking. Each tool's source is on GitHub.
sidebar:
  label: All tools
  order: 100
---

Free utilities for working with Plinth and the adjacent stacks Plinth integrates — Cerbos, OpenTelemetry, CloudEvents, Helm, RFC&nbsp;7807. No signup. No tracking. Each tool's source is on GitHub. Each tool's URL is bookmarkable and shareable.

## [Plinth Sketch](/tools/sketch/) — *live*

A visual + DSL editor for system architecture diagrams. Type a few lines of plain text — components, edges, layers — get a typeset SVG matching this site's design language. Share via URL. Available as a [CLI + GitHub Action](https://github.com/plinth-dev/sketch) so you can render diagrams at build time and embed them in any README.

```bash
npm install -g @plinth-dev/sketch
plinth-sketch architecture.sketch -o architecture.svg
```

The diagram on the [v0.1.0 launch page](/launch/v0-1-0/) and elsewhere on this site is rendered with this tool from a 22-line `.sketch` file.

## On the way

Two more tools are in active development. They land when they're worth a reader's time, not before.

- **OTel Config Builder** — drag-and-drop builder for OpenTelemetry Collector configurations. Pick receivers, processors, exporters from a catalog; outputs full YAML. Targets: Tempo, Jaeger, SigNoz, Honeycomb, Datadog, vendor-neutral OTLP.
- **CloudEvents Validator** — paste CloudEvents JSON-lines; validate against the 1.0 spec; render as a queryable timeline. See what Plinth's audit module emits before adopting it.

---

**Want a tool that isn't here?** [File an issue](https://github.com/plinth-dev/.github/issues) describing what you'd build for an internal-tooling fleet. Tools with use cases beyond just Plinth get prioritised.
