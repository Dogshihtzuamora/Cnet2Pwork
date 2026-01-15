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

const rooms = new Map()
const globalTopic = crypto.createHash('sha256').update('p2p-global-chat').digest()

function createRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId)
  
  const room = {
    id: roomId,
    swarm: new Hyperswarm(),
    peers: [],
    topic: crypto.createHash('sha256').update(`p2p-room-${roomId}`).digest(),
    webClients: new Set()
  }
  
  room.swarm.join(room.topic, { lookup: true, announce: true })
  
  room.swarm.on('connection', (conn) => {
    room.peers.push(conn)
    
    conn.on('data', buf => {
      let msg
      try { 
        msg = JSON.parse(buf.toString()) 
      } catch { 
        return 
      }
      
      room.webClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'chat', ...msg }))
        }
      })
    })
    
    conn.on('close', () => {
      const idx = room.peers.indexOf(conn)
      if (idx !== -1) room.peers.splice(idx, 1)
    })
  })
  
  rooms.set(roomId, room)
  return room
}

const globalRoom = createRoom('global')

wss.on('connection', ws => {
  let currentRoom = null
  
  ws.on('message', raw => {
    let data
    try { 
      data = JSON.parse(raw) 
    } catch { 
      return 
    }

    if (data.type === 'join-room') {
      if (currentRoom) {
        currentRoom.webClients.delete(ws)
      }
      
      const room = createRoom(data.roomId)
      room.webClients.add(ws)
      currentRoom = room
      
      ws.send(JSON.stringify({
        type: 'room-joined',
        roomId: data.roomId,
        peerCount: room.peers.length
      }))
      return
    }

    if (data.type === 'chat' && currentRoom) {
      const msg = {
        msgId: crypto.randomUUID(),
        userId: data.userId,
        name: data.name,
        avatar: data.avatar,
        message: data.message,
        replyTo: data.replyTo || null,
        time: Date.now()
      }

      currentRoom.peers.forEach(p => {
        try { 
          p.write(JSON.stringify(msg)) 
        } catch {}
      })

      currentRoom.webClients.forEach(c => {
        if (c.readyState === WebSocket.OPEN && c !== ws) {
          c.send(JSON.stringify({ type: 'chat', ...msg }))
        }
      })
      
      ws.send(JSON.stringify({ type: 'chat', ...msg }))
    }
  })
  
  ws.on('close', () => {
    if (currentRoom) {
      currentRoom.webClients.delete(ws)
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
