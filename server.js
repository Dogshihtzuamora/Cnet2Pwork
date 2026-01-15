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
const topic = crypto.createHash('sha256').update('p2p-chat-rooms-v4').digest()

const rooms = new Map()
const connections = new Map()
const messageHistory = new Map()

wss.on('connection', (ws) => {
  const clientId = crypto.randomBytes(8).toString('hex')
  let currentRoom = null
  
  console.log(`Cliente conectado: ${clientId}`)
  
  ws.send(JSON.stringify({
    type: 'init',
    clientId: clientId,
    peers: connections.size
  }))
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      
      switch(data.type) {
        case 'join':
          if (currentRoom) {
            const oldRoom = rooms.get(currentRoom) || new Set()
            oldRoom.delete(ws)
            rooms.set(currentRoom, oldRoom)
          }
          
          currentRoom = data.room
          const room = rooms.get(currentRoom) || new Set()
          room.add(ws)
          rooms.set(currentRoom, room)
          
          console.log(`Cliente ${clientId} entrou na sala ${currentRoom}`)
          break
          
        case 'chat':
          const roomKey = `${data.room}:${data.id}`
          if (!messageHistory.has(roomKey)) {
            messageHistory.set(roomKey, data)
            
            broadcastToRoom(data.room, data, ws)
            
            connections.forEach(conn => {
              try {
                conn.write(JSON.stringify(data))
              } catch (err) {
                console.error('Erro ao enviar para peer:', err.message)
              }
            })
          }
          break
          
        case 'sync':
          if (data.messages && Array.isArray(data.messages)) {
            data.messages.forEach(msg => {
              const key = `${msg.room}:${msg.id}`
              if (!messageHistory.has(key)) {
                messageHistory.set(key, msg)
              }
            })
          }
          
          const roomMessages = []
          messageHistory.forEach((msg, key) => {
            if (key.startsWith(`${data.room}:`)) {
              roomMessages.push(msg)
            }
          })
          
          ws.send(JSON.stringify({
            type: 'sync',
            room: data.room,
            messages: roomMessages
          }))
          break
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err.message)
    }
  })
  
  ws.on('close', () => {
    console.log(`Cliente desconectado: ${clientId}`)
    if (currentRoom) {
      const room = rooms.get(currentRoom)
      if (room) {
        room.delete(ws)
      }
    }
  })
})

function broadcastToRoom(roomId, data, sender) {
  const room = rooms.get(roomId)
  if (!room) return
  
  room.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}

swarm.join(topic, { lookup: true, announce: true })

swarm.on('connection', (conn, info) => {
  const peerId = info.publicKey.toString('hex').slice(0, 8)
  console.log(`Peer P2P conectado: ${peerId}`)
  
  connections.set(peerId, conn)
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'peer',
        action: 'join',
        peerId: peerId,
        total: connections.size
      }))
    }
  })
  
  conn.on('data', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      
      if (msg.type === 'chat') {
        const key = `${msg.room}:${msg.id}`
        if (!messageHistory.has(key)) {
          messageHistory.set(key, msg)
          broadcastToRoom(msg.room, msg)
        }
      }
    } catch (err) {
      console.error(`Erro ao processar peer ${peerId}:`, err.message)
    }
  })
  
  conn.on('close', () => {
    console.log(`Peer P2P desconectado: ${peerId}`)
    connections.delete(peerId)
    
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'peer',
          action: 'leave',
          peerId: peerId,
          total: connections.size
        }))
      }
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
