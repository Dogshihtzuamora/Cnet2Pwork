const state = {
  userId: localStorage.getItem('uid') || crypto.randomUUID(),
  name: localStorage.getItem('name') || 'User',
  avatar: localStorage.getItem('avatar') || '',
  room: 'global',
  lastMsgId: localStorage.getItem('lastMsgId') || null
}

localStorage.setItem('uid', state.userId)

const ws = new WebSocket(
  (location.protocol==='https:'?'wss://':'ws://') + location.host
)

const messages = document.getElementById('messages')
const input = document.getElementById('text')

ws.onopen = ()=>{
  ws.send(JSON.stringify({
    type:'sync',
    room: state.room,
    lastMsgId: state.lastMsgId
  }))
}

ws.onmessage = e=>{
  const data = JSON.parse(e.data)

  if(data.type === 'history'){
    data.messages.forEach(render)
    return
  }

  if(data.type === 'chat'){
    render(data.message)
  }
}

function render(m){
  if(m.room !== state.room) return

  const div = document.createElement('div')
  div.innerHTML = `
    <b>${m.name}</b><br>
    ${m.text}
    <small>${new Date(m.time).toLocaleTimeString()}</small>
  `
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight

  state.lastMsgId = m.msgId
  localStorage.setItem('lastMsgId', m.msgId)
}

document.getElementById('send').onclick = ()=>{
  if(!input.value.trim()) return

  ws.send(JSON.stringify({
    type:'chat',
    room: state.room,
    userId: state.userId,
    name: state.name,
    avatar: state.avatar,
    text: input.value
  }))

  input.value=''
    }
