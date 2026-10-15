const { Client, LocalAuth } = require('whatsapp-web.js');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

// 🧹 Função de limpeza automática de locks do Chromium
function limparLocks(diretorio) {
    if (!fs.existsSync(diretorio)) return;
    
    fs.readdirSync(diretorio, { withFileTypes: true }).forEach(entidade => {
        const caminhoCompleto = path.join(diretorio, entidade.name);
        if (entidade.isDirectory()) {
            limparLocks(caminhoCompleto);
        } else {
            if (entidade.name.toLowerCase().includes('singleton')) {
                try {
                    fs.unlinkSync(caminhoCompleto);
                    console.log(`🧹 Trava removida: ${caminhoCompleto}`);
                } catch (e) {
                    console.error(`⚠️ Erro ao remover trava: ${caminhoCompleto}`);
                }
            }
        }
    });
}

// Executa a limpeza profunda antes de iniciar
limparLocks(path.join(__dirname, '.wwebjs_auth'));

// Proteção contra quedas não fatais
process.on('uncaughtException', (err) => {
    console.error('⚠️ Erro capturado (não fatal):', err);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
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
                let linhasMenu = '🙏 *Olá! Seja bem-vindo(a) à Secretariado Arquidiocesana de Pastoral.*\n\n' +
                                 'Por favor, envie *apenas o número* correspondente à opção desejada:\n\n';

                results.data.forEach(row => {
                    // Lê diretamente as colunas exatas da planilha: Opção, Categoria e Resposta
                    const opcaoBruta = row['Opção'] || row['Opcao'] || row['opcao'];
                    const categoria = row['Categoria'] || row['categoria'];
                    const resposta = row['Resposta'] || row['resposta'];

                    if (opcaoBruta && resposta) {
                        const opcaoNum = opcaoBruta.toString().trim().replace(/[^0-9]/g, '');
                        const textoResposta = resposta.trim().replace(/\\n/g, '\n');
                        const textoCategoria = categoria ? categoria.trim() : `Opção ${opcaoNum}`;

                        if (opcaoNum) {
                            // Mapeia a resposta completa para a chave do número
                            menuOpcoes[opcaoNum] = textoResposta;
                            
                            // Monta a linha do menu formatada: *1* - Horário de Missa
                            linhasMenu += `*${opcaoNum}* - ${textoCategoria}\n`;
                        }
                    }
                });

                menuFormatadoCache = linhasMenu;
                console.log('✅ Dados da planilha carregados com sucesso! Opções disponíveis:', Object.keys(menuOpcoes));
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar dados da planilha:', error);
    }
}

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
    // Ignora atualizações de status/broadcast, mensagens do próprio bot e grupos
    if (msg.fromMe || msg.from === 'status@broadcast' || msg.isStatus) return;
    if (msg.from.includes('@g.us')) return;

    console.log('📩 Mensagem válida recebida de:', msg.from, '| Conteúdo:', msg.body);

    const chatId = msg.from;
    const texto = msg.body ? msg.body.trim() : '';

    if (aguardandoHumano.has(chatId)) return;

    if (menuOpcoes[texto]) {
        if (texto === '11') {
            aguardandoHumano.add(chatId);
        }
        await client.sendMessage(chatId, menuOpcoes[texto]);
        return;
    }

    await client.sendMessage(chatId, menuFormatadoCache || '🙏 Olá! Envie um número válido de 1 a 11 para ver as opções.');
});
client.initialize();