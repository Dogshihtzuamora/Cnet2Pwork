const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')
const path = require('path')

const app = express()
const server = http.createServer(app)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

const wss = new WebSocket.Server({ server })
const swarm = new Hyperswarm()
const topic = crypto.createHash('sha256').update('p2p-chat-encrypted-v3').digest()
const connections = new Map()

wss.on('connection', (ws) => {
  const clientId = crypto.randomBytes(8).toString('hex')
  console.log(`Cliente conectado: ${clientId}`)
  
  ws.send(JSON.stringify({
    type: 'init',
    clientId: clientId,
    peers: connections.size
  }))
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      
      if (data.type === 'chat') {
        const payload = JSON.stringify({
          type: 'chat',
          username: data.username,
          message: data.message,
          avatar: data.avatar,
          timestamp: Date.now()
        })
        
        let sent = 0
        connections.forEach(conn => {
          try {
            conn.write(payload)
            sent++
          } catch (err) {
            console.error('Erro ao enviar para peer:', err.message)
          }
        })
        
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(payload)
          }
        })
        
        ws.send(JSON.stringify({
          type: 'sent',
          peers: sent,
          messageId: data.messageId
        }))
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err.message)
    }
  })
  
  ws.on('close', () => {
    console.log(`Cliente desconectado: ${clientId}`)
  })
  
  ws.on('error', (err) => {
    console.error(`Erro no cliente ${clientId}:`, err.message)
  })
})

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}

swarm.join(topic, { lookup: true, announce: true })

swarm.on('connection', (conn, info) => {
  const peerId = info.publicKey.toString('hex').slice(0, 8)
  console.log(`Peer P2P conectado: ${peerId}`)
  
  connections.set(peerId, conn)
  
  broadcast({
    type: 'peer',
    action: 'join',
    peerId: peerId,
    total: connections.size
  })
  
  conn.on('data', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      broadcast({
        type: 'chat',
        username: msg.username,
        message: msg.message,
        avatar: msg.avatar,
        timestamp: msg.timestamp,
        peerId: peerId
      })
    } catch (err) {
      console.error(`Erro ao processar dado do peer ${peerId}:`, err.message)
    }
  })
  
  conn.on('close', () => {
    console.log(`Peer P2P desconectado: ${peerId}`)
    connections.delete(peerId)
    broadcast({
      type: 'peer',
      action: 'leave',
      peerId: peerId,
      total: connections.size
    })
  })
  
  conn.on('error', (err) => {
    console.error(`Erro no peer ${peerId}:`, err.message)
  })
})

swarm.on('error', (err) => {
  console.error('Erro no swarm:', err.message)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})

process.on('SIGINT', () => {
  console.log('Encerrando...')
  swarm.destroy()
  server.close()
  process.exit(0)
})
