const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

const aguardandoHumano = new Set();

client.on('qr', (qr) => {
    console.log('ATENÇÃO: Copie o link abaixo e cole no seu navegador para ver o QR Code limpo:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
});

client.on('ready', () => {
    console.log('Robô da pastoral online e operando em formato de menu!');
});

client.on('message', async msg => {
    if (msg.from === 'status@broadcast' || msg.author) return;

    const numero = msg.from;
    const texto = msg.body.trim();

    if (aguardandoHumano.has(numero)) return;

    switch (texto) {
        case '1':
            await client.sendMessage(numero, '*Horários das Missas:*\n\nDomingo: 08h e 19h\nQuarta-feira: 19h\nSexta-feira: 19h');
            break;
        case '2':
            await client.sendMessage(numero, '*Nossos Grupos:*\n\n- Jovens: Sábados às 16h\n- Catequese: Domingos às 09h\n- Casais: Terças às 20h');
            break;
        case '3':
            aguardandoHumano.add(numero);
            await client.sendMessage(numero, '🙏 Um membro da pastoral já vai te responder por aqui. Por favor, aguarde um instante!');
            break;
        default:
            const menuPrincipal = `Olá! Paz e bem. Sou o assistente virtual da Pastoral.\n\nComo posso ajudar hoje? Digite o número da opção:\n\n*1* - Horários de Missa\n*2* - Encontros e Grupos\n*3* - Falar com a coordenação`;
            await client.sendMessage(numero, menuPrincipal);
            break;
    }
});

client.on('message_create', async msg => {
    if (msg.fromMe && msg.body === '/bot') {
        aguardandoHumano.delete(msg.to);
        console.log(`Bot reativado para o chat ${msg.to}`);
    }
});

client.initialize();