const { Client, LocalAuth } = require('whatsapp-web.js');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

// 1. Limpeza automática de travas do Chromium
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

limparLocks(path.join(__dirname, '.wwebjs_auth'));

// Proteção contra erros não fatais
process.on('uncaughtException', (err) => {
    console.error('⚠️ Erro capturado (não fatal):', err);
});

// 2. DECLARAÇÃO E INICIALIZAÇÃO DO CLIENT (Precisa vir ANTES dos eventos do client)
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

// 3. EVENTOS DE ESTABILIDADE E AUTO-RECUPERAÇÃO 24/7
client.on('disconnected', (reason) => {
    console.log('⚠️ Conexão perdida com o WhatsApp:', reason);
    process.exit(1);
});

// Watchdog: Verifica a conexão a cada 5 minutos
setInterval(async () => {
    try {
        if (!client || !client.pupPage) {
            console.log('⚠️ Navegador travado. Forçando reinício automático...');
            process.exit(1);
        }
        
        const state = await client.getState();
        if (state !== 'CONNECTED') {
            console.log(`⚠️ Estado de conexão anormal (${state}). Reiniciando container...`);
            process.exit(1);
        }
    } catch (err) {
        console.error('⚠️ Falha no teste de conexão (Watchdog). Reiniciando robô...');
        process.exit(1);
    }
}, 5 * 60 * 1000);

// Reinício preventivo a cada 24 horas para limpar memória do Chromium
setTimeout(() => {
    console.log('🔄 Executando reinício diário preventivo de rotina...');
    process.exit(0);
}, 24 * 60 * 60 * 1000);

// 4. INTEGRAÇÃO COM A PLANILHA DO GOOGLE SHEETS
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
                let linhasMenu = '🙏 *Olá! Seja bem-vindo(a) à Secretariado Arquidiocesano da Pastoral.*\n\n' +
                                 'Por favor, envie *apenas o número* correspondente à opção desejada:\n\n';

                results.data.forEach(row => {
                    const opcaoBruta = row['Opção'] || row['Opcao'] || row['opcao'];
                    const categoria = row['Categoria'] || row['categoria'];
                    const resposta = row['Resposta'] || row['resposta'];

                    if (opcaoBruta && resposta) {
                        const opcaoNum = opcaoBruta.toString().trim().replace(/[^0-9]/g, '');
                        const textoResposta = resposta.trim().replace(/\\n/g, '\n');
                        const textoCategoria = categoria ? categoria.trim() : `Opção ${opcaoNum}`;

                        if (opcaoNum) {
                            menuOpcoes[opcaoNum] = textoResposta;
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

// 5. EVENTOS DO CLIENTE WHATSAPP
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

client.on('message', async msg => {
    // Ignora status, mensagens enviadas pelo próprio bot e grupos
    if (msg.fromMe || msg.from === 'status@broadcast' || msg.isStatus) return;
    if (msg.from.includes('@g.us')) return;

    const chatId = msg.from;
    const textoBruto = msg.body ? msg.body.trim() : '';

    // Permite encerrar o atendimento humano com um comando
    if (textoBruto === '#voltar' || textoBruto === '#sair') {
        aguardandoHumano.delete(chatId);
        await client.sendMessage(chatId, '✅ Atendimento humano encerrado. Menu automático reativado!');
        await client.sendMessage(chatId, menuFormatadoCache);
        return;
    }

    if (aguardandoHumano.has(chatId)) return;

    const numeroDigitado = textoBruto.replace(/[^0-9]/g, '');
    const opcaoEncontrada = menuOpcoes[numeroDigitado] ? numeroDigitado : (menuOpcoes[textoBruto] ? textoBruto : null);

    // Substitua o trecho de seleção de opção por este:
if (opcaoEncontrada) {
    console.log(`✅ Opção [${opcaoEncontrada}] selecionada por ${chatId}`);
    
    // Atualizado para a Opção 12 (Falar com a coordenação)
    if (opcaoEncontrada === '12') {
        aguardandoHumano.add(chatId);
    }
    
    await client.sendMessage(chatId, menuOpcoes[opcaoEncontrada]);
    return;
}

    const menuComErro = menuFormatadoCache + '\n❌ _Não reconheci essa opção. Envie apenas o número desejado._';
    await client.sendMessage(chatId, menuComErro);
});

client.initialize();