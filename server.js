const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')
const path = require('path')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.use(express.static(__dirname))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

const swarm = new Hyperswarm()
const topic = crypto.createHash('sha256').update('p2p-chat-app-v2').digest()

const peers = []
const users = new Map()      // userId -> { name, avatar }
const usedNames = new Set()
const history = []
const MAX_HISTORY = 300

function broadcastWeb(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg)
  })
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    type: 'init',
    users: Array.from(users.entries()),
    history
  }))

  ws.on('message', raw => {
    let data
    try { data = JSON.parse(raw) } catch { return }

    if (data.type === 'register') {
      if (usedNames.has(data.name)) {
        ws.send(JSON.stringify({ type: 'register-error', reason: 'Nome já existe' }))
        return
      }

      usedNames.add(data.name)
      users.set(data.userId, { name: data.name, avatar: data.avatar })

      broadcastWeb({
        type: 'user-join',
        userId: data.userId,
        name: data.name,
        avatar: data.avatar
      })
      return
    }

    if (data.type === 'chat') {
      const msg = {
        msgId: crypto.randomUUID(),
        userId: data.userId,
        name: data.name,
        avatar: data.avatar,
        message: data.message,
        replyTo: data.replyTo || null,
        time: Date.now()
      }

      history.push(msg)
      if (history.length > MAX_HISTORY) history.shift()

      peers.forEach(p => {
        try { p.write(JSON.stringify(msg)) } catch {}
      })

      broadcastWeb({ type: 'chat', ...msg })
    }
  })
})

swarm.join(topic, { lookup: true, announce: true })

swarm.on('connection', (conn, info) => {
  peers.push(conn)

  conn.on('data', buf => {
    let msg
    try { msg = JSON.parse(buf.toString()) } catch { return }

    history.push(msg)
    if (history.length > MAX_HISTORY) history.shift()

    broadcastWeb({ type: 'chat', ...msg })
  })

  conn.on('close', () => {
    const i = peers.indexOf(conn)
    if (i !== -1) peers.splice(i, 1)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server ON:', PORT)
})
