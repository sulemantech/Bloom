/**
 * AI features. Everything goes through gateway.ts (consent, limits, logging), so the provider or
 * model can change without touching the app.
 */
export { aiConfigured, type AiCapability, type AiFailure, type AiResult } from "./gateway";
export { draftProgressCard, type DraftProgressCardInput } from "./progress-card";
export { askBloom, planBloomPath, reviewBloomAnswers, suggestBloomPaths, writeBloomStep, type BloomContext, type BloomPlan, type BloomSuggestion } from "./bloom";
