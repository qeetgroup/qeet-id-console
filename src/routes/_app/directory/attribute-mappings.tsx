import { createFileRoute } from "@tanstack/react-router";
import { MappingsPage } from "@/modules/directory";

export const Route = createFileRoute("/_app/directory/attribute-mappings")({
  component: MappingsPage,
});
