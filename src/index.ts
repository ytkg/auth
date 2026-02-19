import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { sign, jwt, verify } from 'hono/jwt'
import llmsTxt from './llms.txt'

type AppEnv = {
  Bindings: {
    USERNAME: string
    PASSWORD: string
    JWT_SECRET: string
    JWT_REFRESH_SECRET: string
  }
}

type TokenKind = 'access' | 'refresh'

type TokenPayload = {
  username: string
  type: TokenKind
  jti: string
  iat: number
  exp: number
}

const app = new Hono<AppEnv>()
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

const getRefreshSecret = (c: Context<AppEnv>) => c.env.JWT_REFRESH_SECRET || c.env.JWT_SECRET

const parseJsonBody = async (c: Context<AppEnv>): Promise<Record<string, unknown> | null> => {
  try {
    return await c.req.json<Record<string, unknown>>()
  } catch {
    return null
  }
}

const issueTokens = async (c: Context<AppEnv>, username: string) => {
  const now = Math.floor(Date.now() / 1000)
  const accessPayload: TokenPayload = {
    username,
    type: 'access',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  }
  const refreshPayload: TokenPayload = {
    username,
    type: 'refresh',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SECONDS,
  }

  const accessToken = await sign(accessPayload, c.env.JWT_SECRET)
  const refreshToken = await sign(refreshPayload, getRefreshSecret(c))

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  }
}

app.get('/llms.txt', (c) => {
  return c.text(llmsTxt, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
})

app.post('/login', async (c) => {
  const body = await parseJsonBody(c)
  const username = typeof body?.username === 'string' ? body.username : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!username || !password) {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  if (username !== c.env.USERNAME || password !== c.env.PASSWORD) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  return c.json(await issueTokens(c, username))
})

const verifyJwt: MiddlewareHandler<AppEnv> = (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET })

  return jwtMiddleware(c, next)
}

app.get('/verify', verifyJwt, (c) => {
  const payload = c.get('jwtPayload')

  if (payload?.type && payload.type !== 'access') {
    return c.json({ error: 'Invalid token type' }, 401)
  }

  return c.json({ payload })
})

app.post('/refresh', async (c) => {
  const body = await parseJsonBody(c)
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''

  if (!refreshToken) {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  try {
    const payload = await verify(refreshToken, getRefreshSecret(c))

    if (payload.type !== 'refresh' || typeof payload.username !== 'string') {
      return c.json({ error: 'Invalid refresh token' }, 401)
    }

    return c.json(await issueTokens(c, payload.username))
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401)
  }
})

export default app
