const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')
const path = require('path')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

const swarm = new Hyperswarm()
const topic = crypto.createHash('sha256').update('p2p-chat-app-v2').digest()

const peers = []

function broadcastWeb(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg))
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({
    type: 'status',
    connections: peers.length
  }))

  ws.on('message', raw => {
    let data
    try { data = JSON.parse(raw) } catch { return }

    if (data.type === 'chat') {
      const payload = JSON.stringify(data)
      peers.forEach(p => p.write(payload))

      broadcastWeb({
        type: 'chat',
        username: data.username,
        message: data.message,
        replyTo: data.replyTo || null,
        self: false
      })
    }
  })
})

swarm.join(topic, { lookup: true, announce: true })

swarm.on('connection', (conn, info) => {
  const id = info.publicKey.toString('hex').slice(0, 8)
  peers.push(conn)

  broadcastWeb({ type: 'peer', action: 'connected', id, total: peers.length })

  conn.on('data', buf => {
    let msg
    try { msg = JSON.parse(buf.toString()) } catch { return }

    broadcastWeb({
      type: 'chat',
      username: msg.username,
      message: msg.message,
      replyTo: msg.replyTo || null,
      peerId: id,
      self: false
    })
  })

  conn.on('close', () => {
    const i = peers.indexOf(conn)
    if (i !== -1) peers.splice(i, 1)

    broadcastWeb({ type: 'peer', action: 'disconnected', id, total: peers.length })
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on', PORT)
})
