import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import appCss from "@/styles.css?url";

export const Route = createRootRoute({
  /**
   * Purpose: Define document head metadata and styles for the root route.
   * How: Returns meta tags and stylesheet links for the app shell.
   * Parameters: None.
   * @returns Object with meta and link descriptors.
   */
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TanStack Start Starter" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

/**
 * Purpose: Render the HTML document shell for the app.
 * How: Injects TanStack router content, devtools, and scripts.
 * @param children - Routed application content.
 * @returns JSX.Element - Full document markup.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}

        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
