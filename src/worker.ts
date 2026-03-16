import type { ExecutionContext } from '@cloudflare/workers-types'

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    
    // Fetch the asset
    const response = await env.ASSETS.fetch(request)
    
    // If it's the HTML entrypoint or 404 falling back to SPA, kill the cache and force revalidation
    const contentType = response.headers.get('content-type') || ''
    if (url.pathname === '/' || url.pathname === '/index.html' || contentType.includes('text/html')) {
      const newResponse = new Response(response.body, response)
      newResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      newResponse.headers.set('Pragma', 'no-cache')
      newResponse.headers.set('Expires', '0')
      return newResponse
    }

    return response
  }
}
