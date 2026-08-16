import { env } from "@/platform/config/env";

// Public API origin used only for browser-facing federation/metadata URLs.
// Authenticated data requests go through the same-origin Start BFF.
export const API_BASE_URL = env.VITE_API_URL ?? "http://localhost:4001";
