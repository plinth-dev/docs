---
title: Stand it up in an afternoon
description: Stand up the Plinth substrate on a fresh kind cluster, generate a module, and watch it deploy.
---

:::caution[v0.1.0 status]
The platform chart is *not yet on a registry*. Today you build it from source as shown below. The `helm install oci://…` and Argo-CD reconcile flow are the *v1.0 target*; track progress on the [roadmap](https://github.com/plinth-dev/.github/blob/main/ROADMAP.md).
:::

Prerequisites: Docker, `kubectl`, `helm`, `kind` (or any Kubernetes cluster you already trust), `git`, `go` (1.25+).

## 1. Read

Skim the [manifesto](/manifesto/) (5 minutes) and the [architecture overview](/architecture/) (15 minutes). If the opinions don't match yours, save yourself the install.

## 2. Stand up the platform

```bash
kind create cluster --name plinth
git clone https://github.com/plinth-dev/platform
cd platform
helm dependency update charts/plinth
helm install plinth charts/plinth --values charts/plinth/values-dev.yaml
```

The dev profile spins up a single-node cluster with HA disabled. It's not production-shaped — it's the fastest way to see CloudNativePG + Cerbos + the OpenTelemetry Collector wired together. (Vault, Authentik, Argo CD, the rest of the substrate land incrementally — see *what's not here* below.)

Wait for `kubectl get pods -A` to settle.

## 3. Generate a module

```bash
go install github.com/plinth-dev/cli/cmd/plinth@latest
plinth new my-module --web --api --owner=me
```

The CLI clones the starters, renames identifiers consistently across both, and writes a `.plinth.yaml` capturing the choices. (`--gitlab-push` / `--open-mrs` for GitOps + policy MRs are *v1.0 target* flags; today the new module is local.)

## 4. Deploy your module

```bash
cd my-module-api && make deploy   # Makefile targets in the starters
```

Every module comes up with `/healthz`, `/readyz`, structured-JSON logs, OpenTelemetry traces (sent to the Collector from step 2), Cerbos-fail-closed authorization, and RFC 7807 error responses already wired.

## What's not here

- **Argo CD reconciliation.** The launch v0.1.0 chart deploys directly via Helm. Argo CD app-of-apps lands incrementally toward v1.0.
- **Identity provider.** Authentik / Ory Kratos integration is *roadmapped*. v0.1.0 starters use a dev cookie shim — fine for the walkthrough, not for shipping.
- **Production hardening.** The dev profile turns off HA, replicas, network policies. The `prod` profile is what you actually deploy when those substrate components ship. See [architecture](/architecture/) for the full posture.
- **Bare metal.** The Talos bootstrap path is documented separately; the platform chart targets `kind` first, with bare-metal hardening as a follow-on.
