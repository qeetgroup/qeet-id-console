import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

const csrfMiddleware = createCsrfMiddleware({
  filter: ({ handlerType, request }) =>
    handlerType === "serverFn" || !["GET", "HEAD", "OPTIONS"].includes(request.method),
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}));
