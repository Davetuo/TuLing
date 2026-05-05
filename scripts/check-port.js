// Usage: node check-port.js <host> <port>
const [host, port] = [process.argv[2] || 'localhost', parseInt(process.argv[3] || '5432')];
const c = require('net').createConnection(port, host, () => { c.destroy(); process.exit(0); });
c.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 2000);
