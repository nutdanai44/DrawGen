# Architecture

## Phase 1

- `apps/web`: React + TypeScript editor UI and diagrams.net iframe bridge
- `apps/api`: Fastify health and provider configuration status
- `packages/diagram-core`: shared diagram document/operation domain types
- `packages/ai-contracts`: vendor-neutral AI request/response contracts

## Phase 2

Implement server-side OpenAI and Claude adapters; never expose API keys in browser code.

## Phase 3

Add revision-checked change sets, node/edge diff preview, auto/review approval, import round-trip tests, and editor-sync conflict handling.

Note: diagrams.net's hosted embed requires network even when Vite and Fastify run on localhost.
