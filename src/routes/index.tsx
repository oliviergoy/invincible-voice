import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Invincible Voice" },
      { property: "og:title", content: "Invincible Voice" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dire" });
  },
});
