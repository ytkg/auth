import { Hono } from 'hono'
import { sign, jwt } from 'hono/jwt'

const app = new Hono()
const JWT_TTL_SECONDS = 15 * 60

app.post('/login', async (c) => {
  const { username, password } = await c.req.json()

  if (username !== c.env.USERNAME || password !== c.env.PASSWORD) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    {
      username,
      iat: now,
      exp: now + JWT_TTL_SECONDS,
    },
    c.env.JWT_SECRET
  )

  return c.json({ token })
})

const verifyJwt = (c, next) => {
  const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET })

  return jwtMiddleware(c, next)
}

app.get('/verify', verifyJwt, (c) => {
  const payload = c.get('jwtPayload')

  return c.json({ payload })
})

export default app
