// Types for contract-lib.mjs.
export const DOCUMENTS: string[];
export const CONTRACT_DIR: string;
export const GENERATED_DIR: string;
export function sha256(path: string): string;
export function generateTypes(root: string, name: string): Promise<string>;
