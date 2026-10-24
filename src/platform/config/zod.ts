import { z } from "zod";

// Zod compiles faster validators with `new Function` when eval is allowed, and probes for it; the
// Content-Security-Policy forbids eval, so every page would report a violation. Without it, Zod
// validates the same way, uncompiled.
z.config({ jitless: true });
