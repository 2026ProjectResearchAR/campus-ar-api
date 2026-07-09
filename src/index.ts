import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})


app.get('/api/health', (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/v1/buildings', (c) => {
  return c.json({
    data: [
    {
      id: "uuid",
      name: "図書館",
      marker_count: 3
    }
  ]
  })
})

app.get('/api/v1/spots/:marker_id', (c) => {
  return c.json({
    data: [
      {
        id: "uuid",
        name: "図書館前広場",
        latitude: 35.000,
        longitude: 139.000,
        description: "図書館前のモニュメント",
        ar_assets: [
        {
          type: "3d_model",
          url: "https://r2.example.com/assets/library_mascot.glb"
        }
      ]
      }
    ]
  })
})

app.get('/api/v1/users/me/visits', (c) => {
  return c.json({
  spot_id: "uuid"
  })
})
export default app