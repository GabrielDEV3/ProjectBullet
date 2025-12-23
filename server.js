const WebSocket = require('ws');
const Player = require('./player.js');

class Server {
    constructor(port) {
        this.port = port;
        this.sockets = new Map(); // Map<playerId, socket>
        this.players = new Map(); // Map<playerId, Player>
        this.wss = null;
    }

    // Inicia o servidor
    start() {
        this.wss = new WebSocket.Server({
            port: this.port
        });

        this.wss.on('connection', (socket) => {
            this.onConnect(socket);
        });

        this.wss.on('error', (error) => {
            console.error('Erro no servidor WebSocket:', error);
        });

        // Intervalo de atualizações (25ms)
        setInterval(() => {
            // Envia atualização para todos os clientes
            for (const socket of this.sockets.values()) {
                if (socket.readyState === 1) {
                    const players = [];
                    for (const player of this.players.values()) {
                        players.push(player.toJSON());
                    }

                    socket.send(JSON.stringify({
                        type: 'update',
                        content: {
                            players
                        }
                    }));
                }
            }
        },
            25);

        setInterval(() => {
            this.wss.clients.forEach((socket) => {
                if (socket.isAlive === false) {
                    return socket.terminate();
                }

                socket.isAlive = false;
                socket.ping();
            });
        }, 15000);



        console.log(`Servidor WebSocket rodando na porta ${this.port}`);

        return this;
    }

    // Para o servidor
    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('Servidor WebSocket parado');
        }
    }

    // Processa nova conexão
    onConnect(socket) {
        // Gera ID aleatório único
        let playerId;
        do {
            playerId = Math.floor(Math.random() * 1000000) + 100000;
        } while (this.players.has(playerId));

        const player = new Player(playerId);

        // Armazena as referências
        this.sockets.set(playerId, socket);
        this.players.set(playerId, player);

        // Verifica limite de jogadores (100)
        if (this.players.size > 100) {
            socket.send(JSON.stringify({
                type: 'error',
                content: {
                    message: 'Servidor cheio'
                }
            }));
            socket.close();
            return;
        }

        console.log(`Jogador ${playerId} conectado. Total: ${this.players.size}`);

        // Envia confirmação de conexão
        socket.send(JSON.stringify({
            type: 'connected',
            content: {
                player: player.toJSON()
            }
        }));

        // Configura handlers
        socket.on('message', (message) => this.onMessage(playerId, message));
        socket.on('close', () => this.onClose(playerId));
        socket.on('error', (error) => this.onError(playerId, error));

        // Ping/Pong para manter conexão ativa
        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });
    }

    // Processa mensagens recebidas
    onMessage(playerId, message) {
        try {
            const event = JSON.parse(message);

            if (!event || !event.type) {
                console.warn(`Evento sem tipo do jogador ${playerId}`);
                return;
            }

            const player = this.players.get(playerId);
            if (!player || !this.sockets.get(playerId)) {
                console.warn(`Jogador ${playerId} não encontrado`);
                return;
            }

            switch (event.type) {
                case 'update':
                    this.onUpdate(playerId, event.content);
                    break;

                case 'hit':
                    this.onHit(playerId, event.content);
                    break;

                case 'heal':
                    this.onHeal(playerId, event.content);
                    break;

                case 'exit':
                    this.onExit(playerId, event.content);
                    break;

                default:
                    console.warn(`Tipo de evento desconhecido: ${event.type} do jogador ${playerId}`);
                }
            } catch (error) {
                console.error(`Erro ao processar mensagem do jogador ${playerId}:`, error);
            }
        }

        // Processa desconexão
        onClose(playerId) {
            const player = this.players.get(playerId);
            if (player) {
                console.log(`Jogador ${playerId} "${player.name}" desconectado`);
            }

            this.players.delete(playerId);
            this.sockets.delete(playerId);
            console.log(`Jogador ${playerId} removido. Total: ${this.players.size}`);
        }

        // Processa erro de conexão
        onError(playerId, error) {
            console.error(`Erro no socket do jogador ${playerId}:`, error);
            this.players.delete(playerId);
            this.sockets.delete(playerId);
        }

        // Processa atualização do jogador
        onUpdate(playerId, content) {
            const player = this.players.get(playerId);
            if (player && content && content.player) {
                player.fromJSON(content.player);
            }
        }

        // Processa hit
        onHit(hiterId, content) {
            if (!content || !content.target || !content.amount || content.amount <= 0) {
                console.warn(`Hit inválido de ${hiterId}:`, content);
                return;
            }

            const {
                target,
                amount
            } = content;
            const hiter = this.players.get(hiterId);
            const targetPlayer = this.players.get(target);
            const targetSocket = this.sockets.get(target);

            // Validações
            if (!hiter || !targetPlayer || !targetSocket) {
                console.warn(`Jogador não encontrado para hit: hiter=${hiterId}, target=${target}`);
                return;
            }

            // Não permite jogadores mortos causarem dano
            if (!hiter.isAlive) {
                console.log(`Jogador ${hiterId} está morto e não pode causar dano`);
                return;
            }

            /*
       // Não permite causar dano a si mesmo
        if (hiterId === target) {
            console.log(`Jogador ${hiterId} tentou se atingir`);
            return;
        }
        */

            // Aplica o dano
            targetPlayer.hit(amount);
            console.log(`Jogador ${hiterId} atingiu ${target} com ${amount} de dano`);

            // Envia notificação para o alvo
            targetSocket.send(JSON.stringify({
                type: 'hit',
                content: {
                    target, amount
                }
            }));
        }

        // Processa heal
        onHeal(healerId, content) {
            if (!content || !content.target || !content.amount || content.amount <= 0) {
                console.warn(`Heal inválido de ${healerId}:`, content);
                return;
            }

            const {
                target,
                amount
            } = content;
            const healer = this.players.get(healerId);
            const targetPlayer = this.players.get(target);

            // Validações
            if (!healer || !targetPlayer) {
                console.warn(`Jogador não encontrado para heal: healer=${healerId}, target=${target}`);
                return;
            }

            // Apenas jogadores vivos podem curar
            if (!healer.isAlive) {
                console.log(`Jogador ${healerId} está morto e não pode curar`);
                return;
            }

            // Apenas jogadores vivos podem ser curados
            if (!targetPlayer.isAlive) {
                console.log(`Jogador ${target} está morto e não pode ser curado`);
                return;
            }

            // Aplica a cura
            targetPlayer.heal(amount);
            console.log(`Jogador ${healerId} curou ${target} em ${amount}`);
        }

        // Processa exit
        onExit(playerId, content) {
            const socket = this.sockets.get(playerId);
            if (socket && socket.readyState === 1) {
                socket.close();
            }
        }

        // Obtém estatísticas do servidor
        getStats() {
            return {
                count: this.players.size,
                uptime: process.uptime(),
                port: this.port
            };
        }
    }
}
// Exporta a classe e a instância
module.exports = Server;