// Base URL of the qeet-id Go backend. Comes from VITE_API_URL (inlined at build
// time; defaults to the local backend). The app appends `/v1/...` itself.
export const API_BASE_URL =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://localhost:4001";
