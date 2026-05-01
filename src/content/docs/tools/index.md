---
title: Tools
description: Free utilities for working with Plinth and the adjacent stacks Plinth integrates — Cerbos, OpenTelemetry, CloudEvents, Helm, RFC 7807. No signup, no tracking. Each tool's source is on GitHub.
sidebar:
  label: All tools
  order: 100
---

Free utilities for working with Plinth and the adjacent stacks Plinth integrates — Cerbos, OpenTelemetry, CloudEvents, Helm, RFC&nbsp;7807. No signup. No tracking. Each tool's source is on GitHub. Each tool's URL is bookmarkable and shareable.

## Diagrams &amp; visualisation

### [Sketch](/tools/sketch/) — *live*

A visual + DSL editor for system architecture diagrams. Type a few lines of plain text — components, edges, layers — get a typeset SVG matching this site's design language. Share via URL. Export PNG / SVG / embed iframe. Available as a [CLI + GitHub Action](https://github.com/plinth-dev/sketch) so you can render diagrams at build time and embed them in any README.

> **Use instead of** Mermaid (default chrome reads as utility), draw.io (overkill), Excalidraw (looks amateur), screenshotting Whimsical.

```bash
npm install -g @plinth-dev/sketch
plinth-sketch architecture.sketch -o architecture.svg
```

### Module Preview — *coming soon*

Type a `plinth new` command and see the resulting file tree, dependency graph, and SDK surface area in the browser before installing.

## Configuration builders

### OTel Config — *coming soon*

Drag-and-drop builder for OpenTelemetry Collector configurations. Pick receivers, processors, exporters from a catalog; outputs full YAML. Imports existing configs to validate. Targets: Tempo, Jaeger, SigNoz, Honeycomb, Datadog, vendor-neutral OTLP.

### Values Diff — *coming soon*

Paste two Helm `values.yaml` files; see a semantic diff with schema validation against the Plinth platform chart.

## Validators &amp; explorers

### Audit Explorer — *coming soon*

Paste CloudEvents JSON-lines; validate against the 1.0 spec; render as a queryable timeline. See what Plinth's audit module emits before adopting it.

### Problem Builder — *coming soon*

Visual builder for RFC 7807 Problem Details JSON. Validates trace + extension fields. Generates copy-paste code for `sdk-go/errors` and `@plinth-dev/api-client`.

### Cerbos Lint — *coming soon*

Paste a Cerbos policy; check syntax against the v1 schema; simulate decisions against principals you define inline.

---

**Want a tool that isn't here?** [File an issue](https://github.com/plinth-dev/.github/issues) describing what you'd build for an internal-tooling fleet. Tools with use cases beyond just Plinth get prioritised.
