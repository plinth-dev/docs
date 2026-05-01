---
title: Try it in 60 minutes
description: Stand up the Plinth substrate on a fresh kind cluster, generate a module, and watch it deploy.
---

:::note
The `helm install` step below describes the target flow. The platform chart is not yet published; track current status on the [roadmap](https://github.com/plinth-dev/.github/blob/main/ROADMAP.md).
:::

Prerequisites: Docker, `kubectl`, `helm`, `kind` (or any Kubernetes cluster you already trust).

## 1. Read

Skim the [manifesto](/manifesto/) (5 minutes) and the [architecture overview](/architecture/) (15 minutes). If the opinions don't match yours, save yourself the install.

## 2. Stand up the platform

```bash
kind create cluster --name plinth
helm install plinth oci://ghcr.io/plinth-dev/platform --values dev.values.yaml
```

The dev profile spins up a single-node cluster with HA disabled. It's not production-shaped — it's the fastest way to see everything wired together.

When `helm install` finishes, Argo CD reconciles the rest. Wait for `kubectl get applications -n argocd` to settle.

## 3. Generate a module

```bash
brew install plinth-dev/tap/plinth   # or: go install github.com/plinth-dev/cli@latest
plinth new my-module --web --api --owner=me
```

The CLI clones the starters, renames everything, and (with `--gitlab-push` and `--open-mrs`) opens MRs against the GitOps and policies repos.

## 4. See it deployed

```bash
open http://argo.localhost           # Argo CD shows my-module syncing
open http://my-module.localhost      # the module's dashboard
```

You should see your module reconcile in Argo, then come up at its hostname with auth, audit, OTel, and security headers already wired.

## What's not here

- **Production hardening.** The dev profile turns off HA, replicas, network policies, and a chunk of Wazuh / Falco rules. The `prod` profile is what you actually deploy. See [architecture](/architecture/) for the full posture.
- **Bare metal.** The Talos bootstrap path is documented separately; the platform chart targets `kind` first, with bare-metal hardening as a follow-on.
