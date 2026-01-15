const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const Hyperswarm = require('hyperswarm')
const crypto = require('crypto')
const path = require('path')

const app = express()
const server = http.createServer(app)

app.use(express.static(__dirname))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

const wss = new WebSocket.Server({ server })

const rooms = new Map()

function getRoomSwarm(roomId) {
  if (!rooms.has(roomId)) {
    const swarm = new Hyperswarm()
    const topic = crypto.createHash('sha256').update(`p2p-chat-${roomId}`).digest()
    
    const room = {
      swarm,
      topic,
      connections: [],
      webClients: new Set()
    }
    
    swarm.join(topic, { lookup: true, announce: true })
    
    swarm.on('connection', (connection, info) => {
      const peerId = info.publicKey.toString('hex').slice(0, 8)
      console.log(`Peer conectado na sala ${roomId}: ${peerId}`)
      
      room.connections.push(connection)
      
      room.webClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'peer',
            action: 'connected',
            id: peerId,
            total: room.connections.length
          }))
        }
      })
      
      connection.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString())
          
          room.webClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'chat',
                ...message,
                peerId: peerId
              }))
            }
          })
        } catch (err) {
          console.error('Erro ao processar mensagem do peer:', err)
        }
      })
      
      connection.on('close', () => {
        console.log(`Peer desconectado da sala ${roomId}: ${peerId}`)
        const index = room.connections.indexOf(connection)
        if (index !== -1) {
          room.connections.splice(index, 1)
        }
        
        room.webClients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'peer',
              action: 'disconnected',
              id: peerId,
              total: room.connections.length
            }))
          }
        })
      })
      
      connection.on('error', (err) => {
        console.error(`Erro na conexão com peer ${peerId}:`, err.message)
      })
    })
    
    swarm.on('error', (err) => {
      console.error(`Erro no swarm da sala ${roomId}:`, err.message)
    })
    
    rooms.set(roomId, room)
  }
  
  return rooms.get(roomId)
}

wss.on('connection', (ws) => {
  console.log('Cliente web conectado')
  let currentRoom = null
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message)
      
      if (data.type === 'join-room') {
        if (currentRoom) {
          currentRoom.webClients.delete(ws)
        }
        
        currentRoom = getRoomSwarm(data.roomId)
        currentRoom.webClients.add(ws)
        
        ws.send(JSON.stringify({
          type: 'room-joined',
          roomId: data.roomId,
          connections: currentRoom.connections.length
        }))
      }
      
      if (data.type === 'chat' && currentRoom) {
        const chatMsg = {
          msgId: data.msgId || crypto.randomUUID(),
          userId: data.userId,
          name: data.name,
          avatar: data.avatar,
          message: data.message,
          time: Date.now()
        }
        
        const msgStr = JSON.stringify(chatMsg)
        
        let sentCount = 0
        currentRoom.connections.forEach(conn => {
          try {
            conn.write(msgStr)
            sentCount++
          } catch (err) {
            console.error('Erro ao enviar para peer:', err)
          }
        })
        
        currentRoom.webClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'chat',
              ...chatMsg
            }))
          }
        })
        
        ws.send(JSON.stringify({
          type: 'confirm',
          sentTo: sentCount
        }))
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do cliente:', err)
    }
  })
  
  ws.on('close', () => {
    console.log('Cliente web desconectado')
    if (currentRoom) {
      currentRoom.webClients.delete(ws)
    }
  })
  
  ws.on('error', (err) => {
    console.error('Erro no WebSocket:', err)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})

process.on('SIGINT', () => {
  console.log('Encerrando servidor...')
  rooms.forEach(room => room.swarm.destroy())
  server.close()
  process.exit(0)
})
