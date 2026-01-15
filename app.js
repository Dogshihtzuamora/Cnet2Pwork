const login = document.getElementById('login')
const chat = document.getElementById('chat')
const messages = document.getElementById('messages')
const text = document.getElementById('text')

const state = {
  userId: localStorage.getItem('uid') || crypto.randomUUID(),
  name: localStorage.getItem('name'),
  avatar: localStorage.getItem('avatar'),
  replyTo: null
}

localStorage.setItem('uid', state.userId)

const ws = new WebSocket(
  (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
)

ws.onmessage = e => {
  const data = JSON.parse(e.data)

  if (data.type === 'register-error') {
    document.getElementById('error').textContent = data.reason
  }

  if (data.type === 'init') {
    data.history.forEach(render)
  }

  if (data.type === 'chat') {
    render(data)
  }
}

document.getElementById('create').onclick = () => {
  const name = document.getElementById('name').value.trim()
  const file = document.getElementById('avatar').files[0]

  if (!name) return

  const reader = new FileReader()
  reader.onload = () => {
    state.name = name
    state.avatar = reader.result

    localStorage.setItem('name', name)
    localStorage.setItem('avatar', reader.result)

    ws.send(JSON.stringify({
      type: 'register',
      userId: state.userId,
      name,
      avatar: reader.result
    }))

    login.style.display = 'none'
    chat.style.display = 'flex'
  }
  reader.readAsDataURL(file)
}

document.getElementById('send').onclick = () => {
  if (!text.value.trim()) return

  ws.send(JSON.stringify({
    type: 'chat',
    userId: state.userId,
    name: state.name,
    avatar: state.avatar,
    message: text.value,
    replyTo: state.replyTo
  }))

  text.value = ''
}

function render(m) {
  const div = document.createElement('div')
  div.className = 'msg ' + (m.userId === state.userId ? 'self' : 'other')

  div.innerHTML = `
    <img src="${m.avatar}">
    <b>${m.name}</b><br>
    ${m.message}
  `
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
    }
