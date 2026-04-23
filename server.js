import { createServer } from 'http'
import handler from './dist/server/index.js'

const port = process.env.PORT || 3000

const server = createServer((req, res) => {
  handler.fetch(req, { respondWith: (r) => r }).then((response) => {
    res.writeHead(response.status, Object.fromEntries(response.headers))
    response.body.pipeTo(new WritableStream({
      write(chunk) {
        res.write(chunk)
      },
      close() {
        res.end()
      }
    }))
  })
})

server.listen(port, () => {
  console.log(`🚀 Server rodando na porta ${port}`)
})
