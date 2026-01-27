import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/chat/ChatApp";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return <ChatApp />;
}
