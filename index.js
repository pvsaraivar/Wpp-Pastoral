const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Papa = require('papaparse');
const axios = require('axios');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

// Substitua pelo link CSV público da sua planilha do Google Sheets
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1q_Q6oFByVbSylugQUku3OB56HFZhIfCh_z0GAV8r-28/export?format=csv&gid=0';

let menuOpcoes = {};

// Função para carregar os dados atualizados da planilha
async function carregarDadosPlanilha() {
    try {
        const response = await axios.get(SHEET_CSV_URL);
        Papa.parse(response.data, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                menuOpcoes = {};
                results.data.forEach(row => {
                    // Assume colunas: 'Opcao', 'Categoria', 'Resposta' (ajuste conforme os nomes na sua planilha)
                    if (row.Opcao && row.Resposta) {
                        menuOpcoes[row.Opcao.trim()] = row.Resposta.trim();
                    }
                });
                console.log('✅ Dados da planilha atualizados com sucesso!');
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar dados da planilha:', error);
    }
}

// Atualiza os dados a cada 10 minutos para refletir mudanças na planilha automaticamente
setInterval(carregarDadosPlanilha, 10 * 60 * 1000);

client.on('qr', (qr) => {
    console.log('ATENÇÃO: Copie o link abaixo e cole no seu navegador para ver o QR Code limpo:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
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

    // Se o contato já estiver em atendimento humano, o bot silencia
    if (aguardandoHumano.has(chatId)) return;

    // Se a mensagem enviada corresponde a uma opção válida na planilha (de 1 a 11)
    if (menuOpcoes[texto]) {
        // Se for a opção 11 (falar com a coordenação), ativa o transbordo humano
        if (texto === '11') {
            aguardandoHumano.add(chatId);
            await client.sendMessage(chatId, menuOpcoes[texto]);
            return;
        }

        // Envia a resposta correspondente cadastrada na planilha
        await client.sendMessage(chatId, menuOpcoes[texto]);
        return;
    }

    // Caso contrário (mensagem fora do escopo / saudação / texto inválido), envia o menu principal
    let textoMenu = '🙏 *Olá! Seja bem-vindo(a) à Secretaria Paroquial.*\n\n' +
                    'Por favor, envie **apenas o número** correspondente à opção desejada:\n\n';

    // Monta o menu dinamicamente com base nas opções da planilha
    for (const [opcao, resposta]] of Object.entries(menuOpcoes)) {
        // Extrai uma breve descrição da resposta ou usa o número
        textoMenu += `*${opcao}* - Opção ${opcao}\n`;
    }

    textoMenu += '\n❌ _Não reconheci essa opção. Envie um número válido._';

    await client.sendMessage(chatId, textoMenu);
});

client.initialize();