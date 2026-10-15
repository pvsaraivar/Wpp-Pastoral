const fs = require('fs');
const path = require('path');

// 🛡️ Remove automaticamente qualquer trava de perfil do Chromium ao iniciar
const caminhosLocks = [
    path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonLock'),
    path.join(__dirname, '.wwebjs_auth', 'session', 'Default', 'SingletonLock'),
    path.join(__dirname, '.wwebjs_auth', 'SingletonLock'),
    path.join(__dirname, '.wwebjs_auth', 'session', 'SingletonSocket'),
    path.join(__dirname, '.wwebjs_auth', 'session', 'Default', 'SingletonSocket')
];

caminhosLocks.forEach(caminho => {
    if (fs.existsSync(caminho)) {
        try {
            fs.unlinkSync(caminho);
            console.log(`🧹 Trava removida com sucesso: ${caminho}`);
        } catch (e) {
            console.log(`⚠️ Não foi possível remover a trava: ${caminho}`);
        }
    }
});

const { Client, LocalAuth } = require('whatsapp-web.js');
const Papa = require('papaparse');

// Proteção contra quedas não fatais
process.on('uncaughtException', (err) => {
    console.error('⚠️ Erro capturado (não fatal):', err);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        timeout: 60000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1q_Q6oFByVbSylugQUku3OB56HFZhIfCh_z0GAV8r-28/export?format=csv&gid=0';

let menuOpcoes = {};
let menuFormatadoCache = '';

async function carregarDadosPlanilha() {
    try {
        const response = await fetch(SHEET_CSV_URL);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                menuOpcoes = {};
                let linhasMenu = '🙏 *Olá! Seja bem-vindo(a) à Secretaria Paroquial.*\n\n' +
                                 'Por favor, envie **apenas o número** correspondente à opção desejada:\n\n';

                results.data.forEach(row => {
                    const keys = Object.keys(row);
                    const chaveOpcao = keys.find(k => k.toLowerCase().includes('opç') || k.toLowerCase().includes('opcao'));
                    const chaveResposta = keys.find(k => k.toLowerCase().includes('resp') || k.toLowerCase().includes('desc') || k.toLowerCase().includes('categoria') || k.toLowerCase().includes('texto'));

                    if (chaveOpcao && chaveResposta) {
                        const opcao = row[chaveOpcao]?.trim();
                        const resposta = row[chaveResposta]?.trim();
                        
                        if (opcao && resposta) {
                            menuOpcoes[opcao] = resposta.replace(/\\n/g, '\n');
                            
                            // Cria uma linha limpa para o menu principal (pega a primeira linha do texto ou um resumo)
                            const resumo = resposta.split('\n')[0].substring(0, 40);
                            linhasMenu += `*${opcao}* - ${resumo}...\n`;
                        }
                    }
                });

                linhasMenu += '\n❌ _Não reconheci essa opção. Envie um número válido._';
                menuFormatadoCache = linhasMenu;
                
                console.log('✅ Dados da planilha carregados com sucesso! Total de opções:', Object.keys(menuOpcoes).length);
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar dados da planilha:', error);
    }
}

// Carrega os dados no arranque e a cada 10 minutos
carregarDadosPlanilha();
setInterval(carregarDadosPlanilha, 10 * 60 * 1000);

client.on('qr', (qr) => {
    console.log('==================================================');
    console.log('ATENÇÃO: Copie o link abaixo e cole no seu navegador para ver o QR Code limpo:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
    console.log('==================================================');
});

client.on('ready', () => {
    console.log('🚀 Robô da paróquia online e operando em formato de menu!');
});

const aguardandoHumano = new Set();
const mensagensProcessadas = new Set();

client.on('message', async msg => {
    if (msg.fromMe) return;

    // Evita duplicidade caso o WhatsApp dispare o evento repetido para a mesma mensagem
    const messageId = msg.id._serialized;
    if (mensagensProcessadas.has(messageId)) return;
    mensagensProcessadas.add(messageId);
    setTimeout(() => mensagensProcessadas.delete(messageId), 30000); // Limpa cache após 30s

    const chatId = msg.from;
    const texto = msg.body.trim();

    if (aguardandoHumano.has(chatId)) return;

    // Se a opção digitada existe na planilha
    if (menuOpcoes[texto]) {
        if (texto === '11') {
            aguardandoHumano.add(chatId);
        }
        await client.sendMessage(chatId, menuOpcoes[texto]);
        return;
    }

    // Caso contrário, envia o menu principal formatado corretamente
    await client.sendMessage(chatId, menuFormatadoCache || '🙏 Olá! Envie um número válido de 1 a 11 para ver as opções.');
});

client.initialize();