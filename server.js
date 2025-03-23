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
const topic = crypto.createHash('sha256')
  .update('p2p-chat-app-v2')
  .digest()

const connections = []

wss.on('connection', (ws) => {
  console.log('Cliente web conectado')
  
  ws.send(JSON.stringify({
    type: 'status',
    connections: connections.length,
    message: 'Conectado ao servidor'
  }))
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      
      if (data.type === 'chat') {
        const chatMsg = JSON.stringify({
          type: 'chat',
          username: data.username,
          message: data.message
        })
        
        let sentCount = 0
        connections.forEach(conn => {
          try {
            conn.write(chatMsg)
            sentCount++
          } catch (err) {
            console.error('Erro ao enviar para peer:', err)
          }
        })
        
        ws.send(JSON.stringify({
          type: 'confirm',
          messageId: data.messageId,
          sentTo: sentCount
        }))
        
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'chat',
              username: data.username,
              message: data.message,
              self: false
            }))
          }
        })
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do cliente:', err)
    }
  })
  
  ws.on('close', () => {
    console.log('Cliente web desconectado')
  })
})

function broadcastToWeb(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message))
    }
  })
}

swarm.join(topic, {
  lookup: true,
  announce: true
})

swarm.on('connection', (connection, info) => {
  const peerId = info.publicKey.toString('hex').slice(0, 8)
  console.log(`Peer conectado: ${peerId}`)
  
  connections.push(connection)
  
  broadcastToWeb({
    type: 'peer',
    action: 'connected',
    id: peerId,
    total: connections.length
  })
  
  connection.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString())
      console.log(`Mensagem recebida de ${peerId}:`, message)
      
      broadcastToWeb({
        type: 'chat',
        username: message.username,
        message: message.message,
        peerId: peerId,
        self: false
      })
    } catch (err) {
      console.error(`Erro ao processar mensagem do peer ${peerId}:`, err)
    }
  })
  
  connection.on('close', () => {
    console.log(`Peer desconectado: ${peerId}`)
    const index = connections.indexOf(connection)
    if (index !== -1) {
      connections.splice(index, 1)
    }
    
    broadcastToWeb({
      type: 'peer',
      action: 'disconnected',
      id: peerId,
      total: connections.length
    })
  })
  
  connection.on('error', (err) => {
    console.error(`Erro na conexão com peer ${peerId}:`, err.message)
  })
})

swarm.on('error', (err) => {
  console.error('Erro no swarm:', err.message)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`)
})

process.on('SIGINT', () => {
  console.log('Encerrando servidor...')
  swarm.destroy()
  server.close()
  process.exit(0)
})
