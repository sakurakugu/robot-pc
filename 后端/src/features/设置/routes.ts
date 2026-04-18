import { Router } from 'express'

export function createStudioConfigRoutes(): Router {
  const router = Router()

  router.get('/ui', (_req, res) => {
    res.json({
      success: true,
      data: {
        serverUrl: '',
      },
    })
  })

  return router
}
