// src/whatsapp/WhatsAppClient.js
// const { Client, RemoteAuth } = require('whatsapp-web.js');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs'); 

const qrcode = require('qrcode-terminal');

const OpenAIModule = require('../openai')

const { saveConversationState, saveBotResponse } = require('../../utils/ConversationStateManager');
const { convertAudioToMp3, transcribeAudioWithWhisper, checkAndUpdateRateLimit } = require('../../utils');

require('dotenv').config();

class WhatsAppClient {
    constructor() {
        this.client = null;
    }

    init() {
        try {       
            const client = new Client({
                authStrategy: new LocalAuth()
            });

            client.on('qr', (qr) => {
                console.log('QR RECEIVED');
                qrcode.generate(qr, { small: true })
            });

            client.on('remote_session_saved', () => {
                console.log('Sessão do WhatsApp salva no banco de dados remoto');
            });

            client.on('ready', () => {
                console.log('WhatsAppClient is ready!');
            });

            client.on('message', async msg => {
                const chatId = msg.from;
                const messageType = msg.type;

                const threadId = await OpenAIModule.ensureThreadId(chatId)

                const rateLimitCheckState = await checkAndUpdateRateLimit(chatId)

                if (!['chat', 'ptt', 'text'].includes(messageType)) {
                    const messageContent = msg.body
                    const defaultMessage = "Desculpe, no momento só posso responder a mensagens de texto e áudio.";
                    msg.reply(defaultMessage);

                    await saveConversationState(chatId, messageContent, messageType.toString(), threadId, false);
                } else {
                    if (rateLimitCheckState.startsWith("CooldownActivated timeLeft")) {
                        client.sendMessage(msg.from, `Obrigado por falar comigo, muito prazer em lhe conhecer e espero que eu tenha te ajudado! Como estou em versão Alpha e fase de testes, no momento você utilizou todas as mensagens do período de testes. Mas ta tudo certo, espere mais ${rateLimitCheckState.slice(26)} para me chamar de novo e iniciar outra conversa.`);
                    } else {
                        if (msg.type === 'ptt') {
                            try {
                                const audioMedia = await msg.downloadMedia();
                                const audioBuffer = Buffer.from(audioMedia.data, 'base64');
                                const audioPath = `./tempAudio.oga`; // OGG format file
                                const convertedAudioPath = `./convertedAudio.mp3`; // Target MP3 format file

                                fs.writeFileSync(audioPath, audioBuffer);

                                // Convert audio to MP3
                                await convertAudioToMp3(audioPath, convertedAudioPath);

                                // Transcribe audio
                                const transcription = await transcribeAudioWithWhisper(convertedAudioPath);
                                console.log(`Transcription: ${transcription}`);
                                const [newAssistantMessage, rundId] = await OpenAIModule.handleAddMessageToThread(threadId, msg, transcription);
                                const userMessage = transcription
                                const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId, process.env.OPENAI_ASSISTANT_ID);

                                try {
                                    // Process and respond to the transcribed text
                                    const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, rundId, newAssistantMessage)
                                    msg.reply(assistantResponse);

                                    await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, process.env.OPENAI_ASSISTANT_ID);
                                } catch (error) {
                            
                                }
                            } catch (error) {
                                console.error('Error processing voice message:', error);
                            }
                        } else {
                            const [newAssistantMessage, rundId] = await OpenAIModule.handleAddMessageToThread(threadId, msg);
                            const userMessage = msg.body
                            const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId, process.env.OPENAI_ASSISTANT_ID);
                
                            try {
                                const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, rundId, newAssistantMessage)
                                msg.reply(assistantResponse);

                                await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, process.env.OPENAI_ASSISTANT_ID);
                            } catch (error) {
                                console.error('Erro ao receber mensagem do Assistant: ', error);
                                msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
                            }
                        }
                    }
                }
            });

            return client.initialize();

        } catch (error) {
            console.error('Error during initialization', error);
            throw error;
        }
    }
}

module.exports = new WhatsAppClient();

