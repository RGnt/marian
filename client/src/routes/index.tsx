import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/chat/ChatApp";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

/**
 * Purpose: Render the root route UI.
 * How: Displays the main ChatApp component.
 * Parameters: None.
 * @returns JSX.Element - Home route content.
 */
function HomeRoute() {
  return <ChatApp />;
}
