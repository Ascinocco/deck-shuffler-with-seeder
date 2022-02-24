const fs = require('fs');

fs.rmSync('./screenshots', { recursive: true, force: true });
fs.mkdirSync('./screenshots');