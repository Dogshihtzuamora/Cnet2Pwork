# P2P Chat Application v2

Este projeto é uma aplicação de chat em tempo real utilizando WebSockets para comunicação entre navegadores e Hyperswarm para comunicação P2P (peer-to-peer). Ele permite que os usuários se conectem tanto por meio de um servidor central quanto diretamente entre si, criando uma rede descentralizada.

## Tecnologias utilizadas

- **Node.js**: Framework para rodar o servidor e manipular requisições.
- **Express.js**: Framework para construção de servidores HTTP.
- **WebSocket**: Comunicação bidirecional em tempo real entre o servidor e o cliente.
- **Hyperswarm**: Biblioteca para criar redes P2P descentralizadas.
- **Crypto**: Utilizada para gerar hashes e criar tópicos para a rede P2P.
  
## Como funciona

1. **Servidor Web**: Um servidor Express serve o arquivo `index.html` na raiz. Quando os clientes acessam a página, eles são conectados via WebSocket ao servidor.
  
2. **Comunicação WebSocket**: O servidor WebSocket gerencia conexões com os navegadores e recebe mensagens de chat. Ao receber uma mensagem, o servidor a distribui para todos os outros clientes conectados.
  
3. **Conexões P2P**: Utilizando Hyperswarm, a aplicação cria uma rede P2P onde cada cliente pode se conectar a outros diretamente, sem passar pelo servidor. Mensagens de chat enviadas entre os peers são repassadas a todos os clientes WebSocket conectados.

4. **Mensagens de Chat**: As mensagens de chat são enviadas em formato JSON, com o nome do usuário e o conteúdo da mensagem. A comunicação ocorre tanto via WebSocket quanto entre os peers P2P.

## Instalação

### Requisitos
- Node.js (versão 14 ou superior)

### Passos

1. Clone o repositório:

   ```bash
   git clone https://github.com/Dogshihtzuamora/Cnet2Pwork
   cd p2p-chat-app-v2
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Inicie o servidor:

   ```bash
   node server.js
   ```

4. Acesse a aplicação no navegador através de:

   ```
   http://localhost:3000
   ```

## Contribuições

Se você quiser contribuir para o projeto, sinta-se à vontade para enviar pull requests ou abrir issues.

## Licença

Este projeto é licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para mais detalhes.
