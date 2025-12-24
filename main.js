const Server = require('./server.js');

// Inicia o servidor
const server = new Server(process.env.PORT);

server.start();

// Exibe estatísticas periódicas
setInterval(() => {
    const stats = server.getStats();
    console.log(`[Stats] Jogadores: ${stats.count} | Uptime: ${Math.floor(stats.uptime)}s`);
}, 5000);

// Trata desligamento gracioso
process.on('SIGINT', () => {
    console.log('\nDesligando servidor...');
    server.stop();
    process.exit(0);
});
