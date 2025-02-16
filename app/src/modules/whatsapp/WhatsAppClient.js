// WhatsAppClient.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const fs = require('fs')
const qrcode = require('qrcode-terminal')
const { ADMIN_COMMANDS } = require('../../config')
const { saveConversationState, saveBotResponse } = require('../../utils/ConversationStateManager')
const {
	convertAudioToMp3,
	transcribeAudioWithWhisper,
	checkAudioDuration,
	findAddress,
	checkRunStatusAndWait,
	isValidMessageType,
	generateMariaVoiceMessage,
	probeInputFile,
} = require('../../utils')
const OpenAIModule = require('../openai')
require('dotenv').config()

let userTimers = {}

class WhatsAppClient {
	constructor() {
		this.client = null
	}

	init() {
		try {
			this.client = new Client({
				authStrategy: new LocalAuth(),
				puppeteer: {
					args: ['--no-sandbox', '--disable-setuid-sandbox'],
				},
			})

			this.client.on('qr', (qr) => {
				console.log('QR CODE GENERATED:')
				qrcode.generate(qr, { small: true })
			})

			this.client.on('remote_session_saved', () => {
				console.log('Sessão do WhatsApp salva no banco de dados remoto')
			})

			this.client.on('ready', () => {
				console.log('WhatsAppClient is ready!')
			})

			this.client.on('message', async (msg) => {
				const chatId = msg.from
				const messageType = msg.type
				const threadId = await OpenAIModule.ensureThreadId(chatId)

				// Clear any pending feedback timer for this chat.
				if (userTimers[chatId]) {
					clearTimeout(userTimers[chatId])
					delete userTimers[chatId]
				}

				console.log(`New message from: ${chatId}. Message Content: ${msg.body}`)

				// If a run is still processing, ask the user to wait.
				if (await checkRunStatusAndWait(threadId)) {
					msg.reply(
						'* 🚫 Percebi que você mandou outra mensagem, mas eu ainda estava processando a anterior. Como estou em fase de testes, peço para que mande apenas mensagens individuais e aguarde minha resposta antes de mandar outra mensagem (Essa mensagem será desconsiderada).*'
					)
					return
				}

				// Ignore system messages.
				if (messageType === 'e2e_notification' || messageType === 'notification_template') {
					console.log('WhatsApp System message')
					return
				}

				// Validate supported message types.
				if (!isValidMessageType(messageType)) {
					console.log('Tipo de mensagem não suportado:', messageType)
					msg.reply('Desculpe, no momento só posso responder a mensagens de texto e áudio.')
					return
				}

				// Dispatch based on message type.
				try {
					switch (messageType) {
						case 'ptt':
							await this.handleVoiceMessage(msg, chatId, threadId, messageType)
							break
						case 'location':
							await this.handleLocationMessage(msg, chatId, threadId, messageType)
							break
						default:
							await this.handleTextMessage(msg, chatId, threadId, messageType)
					}
				} catch (error) {
					console.error('Error processing message:', error)
					msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
				}
			})

			return this.client.initialize()
		} catch (error) {
			console.error('Error during initialization', error)
			throw error
		}
	}

	/**
	 * Schedules a delayed feedback message.
	 */
	scheduleFeedback(chatId, msg) {
		userTimers[chatId] = setTimeout(() => {
			msg.reply(
				'Espero que eu tenha te ajudado! Se tiver um momento, adoraria receber seu feedback sobre a sua experiência comigo, é muito importante para que eu possa entender melhor como ajudar a todos! Você pode deixar seu feedback aqui: https://maria-sigma.vercel.app/feedback. Obrigado por usar a MARIA e esperamos conversar com você novamente!'
			)
			delete userTimers[chatId]
		}, 600000) // 10 minutes
	}

	// async handleVoiceMessage(msg, chatId, threadId, messageType) {
	// 	console.log('Received audio message:', msg)
	// 	try {
	// 		const audioMedia = await msg.downloadMedia()
	// 		console.log('Downloaded audio media:', audioMedia)

	// 		const audioBuffer = Buffer.from(audioMedia.data, 'base64')
	// 		const baseName = chatId.slice(0, 12)
	// 		const audioPath = `./${baseName}-tempAudio.ogg`
	// 		const convertedAudioPath = `./${baseName}-convertedAudio.mp3`
	// 		const generatedMariaAudioMessage = `./${baseName}-generatedMariaAudio.mp3`

	// 		fs.writeFileSync(audioPath, audioBuffer)
	// 		probeInputFile(audioPath)
	// 		console.log('Original audio file written to:', audioPath)

	// 		await convertAudioToMp3(audioPath, convertedAudioPath)
	// 		console.log('Converted audio file is ready:', convertedAudioPath)

	// 		const audioDuration = await checkAudioDuration(convertedAudioPath)
	// 		if (audioDuration >= 20) {
	// 			fs.unlinkSync(convertedAudioPath)
	// 			msg.reply(
	// 				'Desculpa, mas por enquanto eu ainda não posso ouvir áudios com 20 segundos ou mais. Vamos tentar de novo?'
	// 			)
	// 			return
	// 		}

	// 		const transcription = await transcribeAudioWithWhisper(convertedAudioPath)
	// 		const { assistantMessageId, runId } = await OpenAIModule.handleAddVoiceMessageToThread(threadId, transcription)
	// 		const userMessage = transcription
	// 		const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)

	// 		try {
	// 			const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
	// 			const audioMessage = await generateMariaVoiceMessage(generatedMariaAudioMessage, assistantResponse)
	// 			msg.reply(assistantResponse)
	// 			if (audioMessage) {
	// 				msg.reply(MessageMedia.fromFilePath(generatedMariaAudioMessage))
	// 				fs.unlinkSync(generatedMariaAudioMessage)
	// 			}
	// 			await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
	// 			this.scheduleFeedback(chatId, msg)
	// 		} catch (error) {
	// 			console.error('Erro ao receber mensagem do Assistant:', error)
	// 			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
	// 		}
	// 	} catch (error) {
	// 		console.error('Error processing voice message:', error)
	// 		msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem de áudio. Tente novamente.')
	// 	}
	// }

	async handleVoiceMessage(msg, chatId, threadId, messageType) {
		// Derive file names based on the chatId
		const baseName = chatId.slice(0, 12)
		const audioPath = `./${baseName}-tempAudio.ogg`
		const convertedAudioPath = `./${baseName}-convertedAudio.mp3`
		const generatedMariaAudioMessage = `./${baseName}-generatedMariaAudio.mp3`
		const MAX_AUDIO_DURATION = 20 // seconds

		try {
			// Download and save the incoming audio media
			const audioMedia = await msg.downloadMedia()
			if (!audioMedia || !audioMedia.data) {
				throw new Error('Audio media download failed')
			}
			const chat = await msg.getChat()
			chat.sendStateRecording()
			const audioBuffer = Buffer.from(audioMedia.data, 'base64')
			fs.writeFileSync(audioPath, audioBuffer)
			probeInputFile(audioPath)
			console.log('Original audio file written to:', audioPath)

			// Convert the audio file to MP3 format
			await convertAudioToMp3(audioPath, convertedAudioPath)
			console.log('Converted audio file is ready:', convertedAudioPath)

			// Check the duration of the converted audio file
			const audioDuration = await checkAudioDuration(convertedAudioPath)
			if (audioDuration >= MAX_AUDIO_DURATION) {
				msg.reply(
					'Desculpa, mas por enquanto eu ainda não posso ouvir áudios com 20 segundos ou mais. Vamos tentar de novo?'
				)
				return
			}

			// Transcribe the audio using Whisper
			const transcription = await transcribeAudioWithWhisper(convertedAudioPath)

			// Add the transcribed message to the OpenAI thread
			const { assistantMessageId, runId } = await OpenAIModule.handleAddVoiceMessageToThread(threadId, transcription)
			const userMessageId = await saveConversationState(chatId, transcription, messageType, threadId)

			// Retrieve the assistant's response and generate a voice reply
			const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
			const audioMessage = await generateMariaVoiceMessage(generatedMariaAudioMessage, assistantResponse)

			// Reply with the assistant text message and optionally with the generated audio message
			msg.reply(assistantResponse)
			if (audioMessage) {
				msg.reply(MessageMedia.fromFilePath(generatedMariaAudioMessage))
				try {
					fs.unlinkSync(generatedMariaAudioMessage)
				} catch (unlinkErr) {
					console.error('Failed to remove generated audio file:', unlinkErr)
				}
			}

			await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
			this.scheduleFeedback(chatId, msg)
		} catch (error) {
			console.error('Error processing voice message:', error)
			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem de áudio. Tente novamente.')
		} finally {
			// Clean up temporary audio files
			;[audioPath, convertedAudioPath].forEach((file) => {
				try {
					if (fs.existsSync(file)) fs.unlinkSync(file)
				} catch (cleanupErr) {
					console.error(`Error cleaning up temporary file ${file}:`, cleanupErr)
				}
			})
		}
	}

	async handleLocationMessage(msg, chatId, threadId, messageType) {
		let address = null
		try {
			address = await findAddress(msg.location.latitude, msg.location.longitude)
		} catch (error) {
			console.error('Error finding address:', error)
		}
		const userMessage = address
		try {
			const { assistantMessageId, runId } = await OpenAIModule.handleAddLocationMessageToThread(threadId, userMessage)
			const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)
			try {
				const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
				msg.reply(assistantResponse)
				await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
				this.scheduleFeedback(chatId, msg)
			} catch (error) {
				console.error('Erro ao receber mensagem do Assistant:', error)
				msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
			}
		} catch (error) {
			console.error('Error processing location message:', error)
			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
		}
	}

	async handleTextMessage(msg, chatId, threadId, messageType) {
		const userMessage = msg.body
		try {
			const chat = await msg.getChat()
			chat.sendStateTyping()
			const { assistantMessageId, runId } = await OpenAIModule.handleAddMessageToThread(threadId, msg)
			const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)
			try {
				const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
				msg.reply(assistantResponse)
				await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
				this.scheduleFeedback(chatId, msg)
			} catch (error) {
				console.error('Erro ao receber mensagem do Assistant:', error)
				msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
			}
		} catch (error) {
			console.error('Error processing text message:', error)
			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
		}
	}
}

module.exports = new WhatsAppClient()
