const { Client, LocalAuth, MessageMedia, Buttons } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const prisma = require('../../app/src/modules/database');

const client = new Client({
                authStrategy: new LocalAuth(),
                puppeteer: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                }
            });

async function main() {
    client.on('qr', qr => {
        qrcode.generate(qr, {small: true});
    });
    
    const listOfUsers = await prisma.userState.findMany({
      select: {
        chatId: true
      }
    })
    
    client.on('ready', () => {
        listOfUsers.forEach(user => {
            // The chatId is already in the correct format
            const chatId = user.chatId; 
            console.log(chatId)

            // Sending an audio file
            client.sendMessage(chatId, MessageMedia.fromFilePath('./Maria-Update.mp3'));

            // Sending a text message
            client.sendMessage(chatId, "Olá eu me chamo Maria, meu software foi atualizado para correção de bugs e trazer ainda mais funcionalidades 😁. E agora sou completamente capaz de entender você por áudio e te responder por mensagens de voz! Sinta-se a vontade para conversar comigo usando sua voz, lembrando que existe um limite de 20 segundos para cada mensagem de áudio! (Mensagens de áudio podem levar alguns segundos a mais para serem completamente processadas)");
        });

        console.log('WhatsAppClient is ready!');
    });
    
    
    client.initialize();
}

main()