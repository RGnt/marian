import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

/**
 * Purpose: Create the TanStack router instance for the app.
 * How: Uses the generated route tree and configures router options.
 * Parameters: None.
 * @returns Router instance ready for rendering.
 */
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })

  return router
}
