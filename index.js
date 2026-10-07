const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// Cole aqui o link CSV público da sua planilha do Google Sheets (com o ID correto)
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1q_Q6oFByVbSylugQUku3OB56HFZhIfCh_z0GAV8r-28/export?format=csv&gid=0';

let menuOpcoes = {};

// Função nativa para carregar os dados da planilha sem precisar de pacotes externos
async function carregarDadosPlanilha() {
    try {
        const response = await fetch(SHEET_CSV_URL);
        const csvText = await response.text();
        
        const linhas = csvText.split('\n');
        menuOpcoes = {};

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas.trim();
            if (!linha) continue;

            const primeiraVirgula = linha.indexOf(',');
            if (primeiraVirgula !== -1) {
                let opcao = linha.substring(0, primeiraVirgula).replace(/"/g, '').trim();
                let resposta = linha.substring(primeiraVirgula + 1).replace(/^"/, '').replace(/"$/, '').trim();
                
                // Substitui quebras de linha literais se houverem
                resposta = resposta.replace(/\\n/g, '\n');
                
                if (opcao && resposta) {
                    menuOpcoes[opcao] = resposta;
                }
            }
        }
        console.log('✅ Dados da planilha carregados com sucesso! Total de opções:', Object.keys(menuOpcoes).length);
    } catch (error) {
        console.error('❌ Erro ao carregar dados da planilha:', error);
    }
}

// Atualiza os dados a cada 10 minutos
setInterval(carregarDadosPlanilha, 10 * 60 * 1000);

client.on('qr', (qr) => {
    console.log('==================================================');
    console.log('ATENÇÃO: Copie o link abaixo e cole no seu navegador para ver o QR Code limpo:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    console.log('==================================================');
});

client.on('ready', async () => {
    console.log('🚀 Robô da paróquia online e operando em formato de menu!');
    await carregarDadosPlanilha();
});

const aguardandoHumano = new Set();

client.on('message', async msg => {
    if (msg.fromMe) return;

    const chatId = msg.from;
    const texto = msg.body.trim();

    if (aguardandoHumano.has(chatId)) return;

    if (menuOpcoes[texto]) {
        if (texto === '11') {
            aguardandoHumano.add(chatId);
            await client.sendMessage(chatId, menuOpcoes[texto]);
            return;
        }
        await client.sendMessage(chatId, menuOpcoes[texto]);
        return;
    }

    let textoMenu = '🙏 *Olá! Seja bem-vindo(a) à Secretaria Paroquial.*\n\n' +
                    'Por favor, envie **apenas o número** correspondente à opção desejada:\n\n';

    for (const [opcao, resposta] of Object.entries(menuOpcoes)) {
        textoMenu += `*${opcao}* - Opção ${opcao}\n`;
    }

    textoMenu += '\n❌ _Não reconheci essa opção. Envie um número válido._';

    await client.sendMessage(chatId, textoMenu);
});

client.initialize();