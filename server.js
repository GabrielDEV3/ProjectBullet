// server.js (com generateId)
const WebSocket = require('ws');
const Player = require('./player.js');
const Weapon = require('./weapon.js');
const { generateId } = require('./utils.js');

class Server {
    constructor(port) {
        this.port = port;
        this.sockets = new Map(); // Map<playerId, socket>
        this.players = new Map(); // Map<playerId, Player>
        this.weapons = new Map(); // Map<weaponId, Weapon>
        this.wss = null;
    }

    start() {
        this.wss = new WebSocket.Server({
            port: this.port
        });

        // Cria algumas armas para teste
        this.createWeapon('pistol', 10, 0, 10, { ammo: 12 });
        this.createWeapon('rifle', -10, 0, 10, { ammo: 30 });

        this.wss.on('connection', (socket) => {
            this.onConnect(socket);
        });

        this.wss.on('error', (error) => {
            console.error('Erro no servidor WebSocket:', error);
        });

        // Intervalo de atualizações
        setInterval(() => {
            for (const socket of this.sockets.values()) {
                if (socket.readyState === 1) {
                    const players = [];
                    for (const player of this.players.values()) {
                        players.push(player.toJSON());
                    }

                    // Coleta TODAS as armas
                    const allWeapons = [];
                    for (const weapon of this.weapons.values()) {
                        allWeapons.push(weapon.toJSON());
                    }

                    socket.send(JSON.stringify({
                        type: 'update',
                        content: {
                            players,
                            weapons: allWeapons
                        }
                    }));
                }
            }
        }, 25);

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

    createWeapon(type = 'pistol', posX = 0, posY = 0, posZ = 0, content = {}) {
        const weaponId = generateId(this.weapons);
        const weapon = new Weapon(weaponId, type, content);
        weapon.px = posX;
        weapon.py = posY;
        weapon.pz = posZ;
        this.weapons.set(weaponId, weapon);
        return weapon;
    }

    onConnect(socket) {
        // Gera ID único para o jogador
        const playerId = generateId(this.players);
        const player = new Player(playerId);
        
        this.sockets.set(playerId, socket);
        this.players.set(playerId, player);

        if (this.players.size > 100) {
            socket.send(JSON.stringify({
                type: 'error',
                content: { message: 'Servidor cheio' }
            }));
            socket.close();
            return;
        }

        console.log(`Jogador ${playerId} conectado. Total: ${this.players.size}`);

        // Envia estado inicial
        const initialPlayers = [];
        for (const p of this.players.values()) {
            initialPlayers.push(p.toJSON());
        }

        const initialWeapons = [];
        for (const weapon of this.weapons.values()) {
            initialWeapons.push(weapon.toJSON());
        }

        socket.send(JSON.stringify({
            type: 'connected',
            content: {
                player: player.toJSON(),
                players: initialPlayers,
                weapons: initialWeapons
            }
        }));

        socket.on('message', (message) => this.onMessage(playerId, message));
        socket.on('close', () => this.onClose(playerId));
        socket.on('error', (error) => this.onError(playerId, error));

        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });
    }

    onMessage(playerId, message) {
        try {
            const event = JSON.parse(message);
            if (!event || !event.type) return;

            const player = this.players.get(playerId);
            if (!player || !this.sockets.get(playerId)) return;

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
                case 'pick':
                    this.onPick(playerId, event.content);
                    break;
                case 'drop':
                    this.onDrop(playerId, event.content);
                    break;
                default:
                    console.warn(`Tipo desconhecido: ${event.type} do ${playerId}`);
            }
        } catch (error) {
            console.error(`Erro ao processar mensagem do ${playerId}:`, error);
        }
    }

    onClose(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            // Larga todas as armas ao desconectar
            for (let i = 0; i < player.slots.length; i++) {
                const weaponId = player.slots[i];
                if (weaponId) {
                    const weapon = this.weapons.get(weaponId);
                    if (weapon) {
                        weapon.parentId = null;
                        weapon.px = player.posX;
                        weapon.py = player.posY;
                        weapon.pz = player.posZ;
                    }
                }
            }
            console.log(`Jogador ${playerId} desconectado`);
        }
        this.players.delete(playerId);
        this.sockets.delete(playerId);
    }

    onError(playerId, error) {
        console.error(`Erro no socket do ${playerId}:`, error);
        this.players.delete(playerId);
        this.sockets.delete(playerId);
    }

    onUpdate(playerId, content) {
        const player = this.players.get(playerId);
        if (!player || !content) return;

        // Atualiza dados do jogador
        if (content.player) {
            const { slots, ...playerData } = content.player;
            player.fromJSON(playerData);
        }

        // Atualiza armas do jogador (opcional)
        if (content.weapons && Array.isArray(content.weapons)) {
            // Atualiza cada arma que pertence ao jogador
            content.weapons.forEach(weaponData => {
                if (weaponData && weaponData.id) {
                    const weapon = this.weapons.get(weaponData.id);
                    if (weapon && weapon.parentId === playerId) {
                        // Mantém o parentId (não deixa o cliente alterar)
                        const originalParentId = weapon.parentId;
                        weapon.fromJSON(weaponData);
                        weapon.parentId = originalParentId; // Mantém o parentId original
                    }
                }
            });
        }
    }

    onHit(hiterId, content) {
        if (!content || !content.target || !content.amount || content.amount <= 0) return;

        const { target, amount } = content;
        const hiter = this.players.get(hiterId);
        const targetPlayer = this.players.get(target);
        const targetSocket = this.sockets.get(target);

        if (!hiter || !targetPlayer || !targetSocket) return;
        if (!hiter.isAlive) return;

        targetPlayer.hit(amount);
        console.log(`${hiterId} atingiu ${target} com ${amount} de dano`);

        targetSocket.send(JSON.stringify({
            type: 'hit',
            content: { target, amount }
        }));
    }

    onHeal(healerId, content) {
        if (!content || !content.target || !content.amount || content.amount <= 0) return;

        const { target, amount } = content;
        const healer = this.players.get(healerId);
        const targetPlayer = this.players.get(target);

        if (!healer || !targetPlayer) return;
        if (!healer.isAlive || !targetPlayer.isAlive) return;

        targetPlayer.heal(amount);
        console.log(`${healerId} curou ${target} em ${amount}`);
    }

    onExit(playerId, content) {
        const socket = this.sockets.get(playerId);
        if (socket && socket.readyState === 1) {
            socket.close();
        }
    }

    onPick(playerId, content) {
        if (!content || content.weaponId === undefined) {
            console.warn(`Pick inválido de ${playerId}:`, content);
            return;
        }

        const player = this.players.get(playerId);
        const weapon = this.weapons.get(content.weaponId);

        if (!player || !weapon) {
            console.warn(`Jogador ou arma não encontrados: player=${playerId}, weapon=${content.weaponId}`);
            return;
        }

        // Verifica se arma está no chão
        if (weapon.parentId !== null) {
            console.log(`Arma ${content.weaponId} já está com jogador ${weapon.parentId}`);
            return;
        }

        // Tenta pegar a arma
        const slotIndex = player.pick(content.weaponId);
        if (slotIndex === -1) {
            console.log(`Jogador ${playerId} não tem slots vazios`);
            return;
        }

        weapon.parentId = playerId;
        console.log(`Jogador ${playerId} pegou arma ${weapon.id} no slot ${slotIndex}`);

        // Envia confirmação
        const socket = this.sockets.get(playerId);
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'pick',
                content: {
                    weaponId: weapon.id,
                    slotIndex: slotIndex
                }
            }));
        }
    }

    onDrop(playerId, content) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Pode dropar arma específica ou do slot atual
        let weaponId;
        if (content && content.weaponId !== undefined) {
            weaponId = content.weaponId;
            // Remove a arma específica do slot do jogador
            for (let i = 0; i < player.slots.length; i++) {
                if (player.slots[i] === weaponId) {
                    player.slots[i] = null;
                    break;
                }
            }
        } else {
            // Drop da arma do slot atual
            weaponId = player.drop();
        }
        
        if (!weaponId) {
            console.log(`Jogador ${playerId} não tem arma para largar`);
            return;
        }

        const weapon = this.weapons.get(weaponId);
        if (!weapon) return;

        weapon.parentId = null;
        
        // Se o jogador enviou posição final da arma, usa, senão coloca na posição do jogador
        if (content && content.weaponData) {
            // Atualiza posição mas mantém parentId como null
            const originalParentId = weapon.parentId;
            weapon.fromJSON(content.weaponData);
            weapon.parentId = originalParentId; // Garante que fica null
        } else {
            // Coloca a arma na posição do jogador
            weapon.px = player.posX;
            weapon.py = player.posY;
            weapon.pz = player.posZ;
        }

        console.log(`Jogador ${playerId} largou arma ${weapon.id}`);

        // Envia confirmação
        const socket = this.sockets.get(playerId);
        if (socket && socket.readyState === 1) {
            socket.send(JSON.stringify({
                type: 'drop',
                content: {
                    weaponId: weapon.id
                }
            }));
        }
    }

    // Método para criar arma customizada
    createCustomWeapon(weaponType, position, rotation, content) {
        const weaponId = generateId(this.weapons);
        const weapon = new Weapon(weaponId, weaponType, content);
        
        if (position) {
            weapon.px = position.x || 0;
            weapon.py = position.y || 0;
            weapon.pz = position.z || 0;
        }
        
        if (rotation) {
            weapon.rx = rotation.x || 0;
            weapon.ry = rotation.y || 0;
            weapon.rz = rotation.z || 0;
        }
        
        this.weapons.set(weaponId, weapon);
        return weapon;
    }

    // Método para remover arma do mundo
    removeWeapon(weaponId) {
        const weapon = this.weapons.get(weaponId);
        if (!weapon) return false;

        // Se a arma está com um jogador, remove do slot dele
        if (weapon.parentId) {
            const player = this.players.get(weapon.parentId);
            if (player) {
                for (let i = 0; i < player.slots.length; i++) {
                    if (player.slots[i] === weaponId) {
                        player.slots[i] = null;
                        break;
                    }
                }
            }
        }

        this.weapons.delete(weaponId);
        return true;
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('Servidor WebSocket parado');
        }
    }

    getStats() {
        return {
            players: this.players.size,
            weapons: this.weapons.size,
            uptime: process.uptime(),
            port: this.port
        };
    }
}

module.exports = Server;
