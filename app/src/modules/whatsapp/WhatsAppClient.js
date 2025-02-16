// // const { Client, LocalAuth, MessageMedia, Buttons } = require('whatsapp-web.js')
// // const fs = require('fs')
// // const qrcode = require('qrcode-terminal')
// // const { ADMIN_COMMANDS } = require('../../config')
// // const { saveConversationState, saveBotResponse } = require('../../utils/ConversationStateManager')
// // const {
// // 	convertAudioToMp3,
// // 	transcribeAudioWithWhisper,
// // 	checkAndUpdateRateLimit,
// // 	checkAudioDuration,
// // 	findAddress,
// // 	checkRunStatusAndWait,
// // 	isValidMessageType,
// // 	generateMariaVoiceMessage,
// // 	probeInputFile,
// // } = require('../../utils')

// // const OpenAIModule = require('../openai')

// // require('dotenv').config()

// // let userTimers = {}

// // class WhatsAppClient {
// // 	constructor() {
// // 		this.client = null
// // 	}

// // 	init() {
// // 		try {
// // 			const client = new Client({
// // 				authStrategy: new LocalAuth(),
// // 				puppeteer: {
// // 					args: ['--no-sandbox', '--disable-setuid-sandbox'],
// // 				},
// // 			})

// // 			client.on('qr', (qr) => {
// // 				console.log('QR CODE GENERATED:')
// // 				qrcode.generate(qr, { small: true })
// // 			})

// // 			client.on('remote_session_saved', () => {
// // 				console.log('Sessão do WhatsApp salva no banco de dados remoto')
// // 			})

// // 			client.on('ready', () => {
// // 				console.log('WhatsAppClient is ready!')
// // 			})

// // 			client.on(
// // 				'message',
// // 				async (msg) => {
// // 					const chatId = msg.from
// // 					const messageType = msg.type
// // 					const threadId = await OpenAIModule.ensureThreadId(chatId)

// // 					// const rateLimitCheckState = await checkAndUpdateRateLimit(chatId)

// // 					if (userTimers[chatId]) {
// // 						clearTimeout(userTimers[chatId])
// // 						delete userTimers[chatId]
// // 					}

// // 					console.log(`New message from: ${chatId}. Message Content: ${msg.body}`)

// // 					if (await checkRunStatusAndWait(threadId)) {
// // 						msg.reply(
// // 							'* 🚫 Percebi que você mandou outra mensagem, mas eu ainda estava processando a anterior. Como estou em fase de testes, peço para que mande apenas mensagens indviduais e aguarde minha resposta antes de mandar outra mensagem (Essa mensagem será desconsiderada).*'
// // 						)
// // 						return
// // 					}

// // 					if (msg.type === 'e2e_notification' || msg.type === 'notification_template') {
// // 						console.log('WhatsApp System message')
// // 						return
// // 					}

// // 					if (!isValidMessageType(messageType)) {
// // 						console.log('Tipo de mensagem não suportado:', messageType)
// // 						msg.reply('Desculpe, no momento só posso responder a mensagens de texto e áudio.')
// // 						return
// // 					}

// // 					// if (rateLimitCheckState.startsWith('CooldownActivated timeLeft')) {
// // 					// 	client.sendMessage(
// // 					// 		msg.from,
// // 					// 		`Obrigado por interagir comig e espero que eu tenha te ajudado! Seu feedback é super importante para que eu possa entender melhor como ajudar a todos. Por favor, compartilhe suas impressões aqui: https://maria-sigma.vercel.app/feedback. Como estou em fase Alpha de desenvolvimento e testes, o limite de mensagens foi atingido. Mas não se preocupe, você poderá falar comigo novamente em ${rateLimitCheckState.slice(
// // 					// 			26
// // 					// 		)}. Até lá!`
// // 					// 	)
// // 					// 	return
// // 					// } else {
// // 					if (msg.type === 'ptt') {
// // 						console.log('Received audio message:', msg)
// // 						try {
// // 							const audioMedia = await msg.downloadMedia()
// // 							console.log('Downloaded audio media:', audioMedia)

// // 							const audioBuffer = Buffer.from(audioMedia.data, 'base64')
// // 							console.log('Audio buffer length:', audioBuffer.length)

// // 							// Use a consistent file extension for the original file (here: .ogg)
// // 							const audioPath = `./${chatId.slice(0, 12)}-tempAudio.ogg`
// // 							probeInputFile(audioPath)
// // 							const convertedAudioPath = `./${chatId.slice(0, 12)}-convertedAudio.mp3`
// // 							const generatedMariaAudioMessage = `./${chatId.slice(0, 12)}-generatedMariaAudio.mp3`

// // 							// Write the original OGG file to disk
// // 							fs.writeFileSync(audioPath, audioBuffer)
// // 							console.log('Original audio file written to:', audioPath)

// // 							// Convert the OGG file to MP3 using the updated conversion function
// // 							await convertAudioToMp3(audioPath, convertedAudioPath)
// // 							console.log('Converted audio file is ready:', convertedAudioPath)

// // 							// Check Audio Duration
// // 							try {
// // 								const audioDuration = await checkAudioDuration(convertedAudioPath)
// // 								if (audioDuration >= 20) {
// // 									fs.unlinkSync(convertedAudioPath)
// // 									msg.reply(
// // 										'Desculpa, mas por enquanto eu ainda não posso ouvir áudios com 20 segundos ou mais. Vamos tentar de novo?'
// // 									)
// // 								} else {
// // 									const transcription = await transcribeAudioWithWhisper(convertedAudioPath)
// // 									const [newAssistantMessage, rundId] = await OpenAIModule.handleAddVoiceMessageToThread(
// // 										threadId,
// // 										transcription
// // 									)
// // 									const userMessage = transcription
// // 									const userMessageId = await saveConversationState(
// // 										chatId,
// // 										userMessage,
// // 										messageType,
// // 										threadId,
// // 										process.env.OPENAI_ASSISTANT_ID
// // 									)

// // 									try {
// // 										const assistantResponse = await OpenAIModule.getAssistantResponse(
// // 											threadId,
// // 											rundId,
// // 											newAssistantMessage
// // 										)
// // 										const audioMessage = await generateMariaVoiceMessage(generatedMariaAudioMessage, assistantResponse)

// // 										msg.reply(assistantResponse)
// // 										if (audioMessage) {
// // 											msg.reply(MessageMedia.fromFilePath(generatedMariaAudioMessage))
// // 											fs.unlinkSync(generatedMariaAudioMessage)
// // 										}

// // 										await saveBotResponse(
// // 											userMessageId,
// // 											chatId,
// // 											assistantResponse,
// // 											threadId,
// // 											process.env.OPENAI_ASSISTANT_ID
// // 										)

// // 										userTimers[chatId] = setTimeout(() => {
// // 											msg.reply(
// // 												'Espero que eu tenha te ajudado! Se tiver um momento, adoraria receber seu feedback sobre a sua experiência comigo, é muito importante para que eu possa entender melhor como ajudar a todos! Você pode deixar seu feedback aqui: https://maria-sigma.vercel.app/feedback. Obrigado por usar a MARIA e esperamos conversar com você novamente!'
// // 											)
// // 											delete userTimers[chatId]
// // 										}, 600000)
// // 									} catch (error) {
// // 										console.error('Erro ao receber mensagem do Assistant: ', error)
// // 										msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// // 									}
// // 								}
// // 							} catch (error) {
// // 								console.error('Error processing voice message:', error)
// // 								msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem de áudio. Tente novamente')
// // 							}
// // 						} catch (error) {
// // 							console.error('Error processing voice message:', error)
// // 						}
// // 					} else {
// // 						let address = null
// // 						let userMessage = null
// // 						if (msg.type === 'location') {
// // 							await findAddress(msg.location.latitude, msg.location.longitude)
// // 								.then((endereco) => (address = endereco))
// // 								.catch((error) => console.error(error))

// // 							userMessage = address
// // 							const [newAssistantMessage, rundId] = await OpenAIModule.handleAddLocationMessageToThread(
// // 								threadId,
// // 								userMessage
// // 							)
// // 							const userMessageId = await saveConversationState(
// // 								chatId,
// // 								userMessage,
// // 								messageType,
// // 								threadId,
// // 								process.env.OPENAI_ASSISTANT_ID
// // 							)

// // 							try {
// // 								const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, rundId, newAssistantMessage)
// // 								msg.reply(assistantResponse)

// // 								await saveBotResponse(
// // 									userMessageId,
// // 									chatId,
// // 									assistantResponse,
// // 									threadId,
// // 									process.env.OPENAI_ASSISTANT_ID
// // 								)

// // 								userTimers[chatId] = setTimeout(() => {
// // 									msg.reply(
// // 										'Espero que eu tenha te ajudado! Se tiver um momento, adoraria receber seu feedback sobre a sua experiência comigo, é muito importante para que eu possa entender melhor como ajudar a todos! Você pode deixar seu feedback aqui: https://maria-sigma.vercel.app/feedback. Obrigado por usar a MARIA e esperamos conversar com você novamente!'
// // 									)
// // 									delete userTimers[chatId]
// // 								}, 600000)
// // 							} catch (error) {
// // 								console.error('Erro ao receber mensagem do Assistant: ', error)
// // 								msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// // 							}
// // 						} else {
// // 							userMessage = msg.body
// // 							const [newAssistantMessage, rundId] = await OpenAIModule.handleAddMessageToThread(threadId, msg)
// // 							const userMessageId = await saveConversationState(
// // 								chatId,
// // 								userMessage,
// // 								messageType,
// // 								threadId,
// // 								process.env.OPENAI_ASSISTANT_ID
// // 							)

// // 							try {
// // 								const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, rundId, newAssistantMessage)
// // 								msg.reply(assistantResponse)

// // 								await saveBotResponse(
// // 									userMessageId,
// // 									chatId,
// // 									assistantResponse,
// // 									threadId,
// // 									process.env.OPENAI_ASSISTANT_ID
// // 								)

// // 								userTimers[chatId] = setTimeout(() => {
// // 									client.sendMessage(
// // 										chatId,
// // 										'Espero que eu tenha te ajudado! Se tiver um momento, adoraria receber seu feedback sobre a sua experiência comigo, é muito importante para que eu possa entender melhor como ajudar a todos! Você pode deixar seu feedback aqui: https://maria-sigma.vercel.app/feedback. Obrigado por usar a MARIA e esperamos conversar com você novamente!'
// // 									)
// // 									delete userTimers[chatId]
// // 								}, 600000)
// // 							} catch (error) {
// // 								console.error('Erro ao receber mensagem do Assistant: ', error)
// // 								msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// // 							}
// // 						}
// // 					}
// // 				}
// // 				// }
// // 			)

// // 			return client.initialize()
// // 		} catch (error) {
// // 			console.error('Error during initialization', error)
// // 			throw error
// // 		}
// // 	}
// // }

// // module.exports = new WhatsAppClient()

// // src/modules/whatsapp/WhatsAppClient.js
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
// const fs = require('fs')
// const qrcode = require('qrcode-terminal')
// const { ADMIN_COMMANDS } = require('../../config')
// const { saveConversationState, saveBotResponse } = require('../../utils/ConversationStateManager')
// const {
// 	convertAudioToMp3,
// 	transcribeAudioWithWhisper,
// 	// checkAndUpdateRateLimit, // currently not used
// 	checkAudioDuration,
// 	findAddress,
// 	checkRunStatusAndWait,
// 	isValidMessageType,
// 	generateMariaVoiceMessage,
// 	probeInputFile,
// } = require('../../utils')
// const OpenAIModule = require('../openai')
// require('dotenv').config()

// let userTimers = {}

// class WhatsAppClient {
// 	constructor() {
// 		this.client = null
// 	}

// 	init() {
// 		try {
// 			this.client = new Client({
// 				authStrategy: new LocalAuth(),
// 				puppeteer: {
// 					args: ['--no-sandbox', '--disable-setuid-sandbox'],
// 				},
// 			})

// 			this.client.on('qr', (qr) => {
// 				console.log('QR CODE GENERATED:')
// 				qrcode.generate(qr, { small: true })
// 			})

// 			this.client.on('remote_session_saved', () => {
// 				console.log('Sessão do WhatsApp salva no banco de dados remoto')
// 			})

// 			this.client.on('ready', () => {
// 				console.log('WhatsAppClient is ready!')
// 			})

// 			this.client.on('message', async (msg) => {
// 				const chatId = msg.from
// 				const messageType = msg.type
// 				const threadId = await OpenAIModule.ensureThreadId(chatId)

// 				// Clear any pending feedback timer for this chat.
// 				if (userTimers[chatId]) {
// 					clearTimeout(userTimers[chatId])
// 					delete userTimers[chatId]
// 				}

// 				console.log(`New message from: ${chatId}. Message Content: ${msg.body}`)

// 				// If a run is still processing, ask the user to wait.
// 				if (await checkRunStatusAndWait(threadId)) {
// 					msg.reply(
// 						'* 🚫 Percebi que você mandou outra mensagem, mas eu ainda estava processando a anterior. Como estou em fase de testes, peço para que mande apenas mensagens individuais e aguarde minha resposta antes de mandar outra mensagem (Essa mensagem será desconsiderada).*'
// 					)
// 					return
// 				}

// 				// Ignore system messages.
// 				if (messageType === 'e2e_notification' || messageType === 'notification_template') {
// 					console.log('WhatsApp System message')
// 					return
// 				}

// 				// Validate supported message types.
// 				if (!isValidMessageType(messageType)) {
// 					console.log('Tipo de mensagem não suportado:', messageType)
// 					msg.reply('Desculpe, no momento só posso responder a mensagens de texto e áudio.')
// 					return
// 				}

// 				// Dispatch message processing based on type.
// 				try {
// 					switch (messageType) {
// 						case 'ptt':
// 							await this.handleVoiceMessage(msg, chatId, threadId, messageType)
// 							break
// 						case 'location':
// 							await this.handleLocationMessage(msg, chatId, threadId, messageType)
// 							break
// 						default:
// 							await this.handleTextMessage(msg, chatId, threadId, messageType)
// 					}
// 				} catch (error) {
// 					console.error('Error processing message:', error)
// 					msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// 				}
// 			})

// 			return this.client.initialize()
// 		} catch (error) {
// 			console.error('Error during initialization', error)
// 			throw error
// 		}
// 	}

// 	/**
// 	 * Schedules a delayed feedback message.
// 	 * @param {string} chatId
// 	 * @param {object} msg - The original message object to reply to.
// 	 */
// 	scheduleFeedback(chatId, msg) {
// 		userTimers[chatId] = setTimeout(() => {
// 			msg.reply(
// 				'Espero que eu tenha te ajudado! Se tiver um momento, adoraria receber seu feedback sobre a sua experiência comigo, é muito importante para que eu possa entender melhor como ajudar a todos! Você pode deixar seu feedback aqui: https://maria-sigma.vercel.app/feedback. Obrigado por usar a MARIA e esperamos conversar com você novamente!'
// 			)
// 			delete userTimers[chatId]
// 		}, 600000) // 10 minutes
// 	}

// 	/**
// 	 * Handles a voice (ptt) message.
// 	 */
// 	async handleVoiceMessage(msg, chatId, threadId, messageType) {
// 		console.log('Received audio message:', msg)
// 		try {
// 			const audioMedia = await msg.downloadMedia()
// 			console.log('Downloaded audio media:', audioMedia)

// 			const audioBuffer = Buffer.from(audioMedia.data, 'base64')
// 			console.log('Audio buffer length:', audioBuffer.length)

// 			const baseName = chatId.slice(0, 12)
// 			const audioPath = `./${baseName}-tempAudio.ogg`
// 			const convertedAudioPath = `./${baseName}-convertedAudio.mp3`
// 			const generatedMariaAudioMessage = `./${baseName}-generatedMariaAudio.mp3`

// 			// Write the original audio file to disk and probe it if needed.
// 			fs.writeFileSync(audioPath, audioBuffer)
// 			probeInputFile(audioPath)
// 			console.log('Original audio file written to:', audioPath)

// 			// Convert to MP3.
// 			await convertAudioToMp3(audioPath, convertedAudioPath)
// 			console.log('Converted audio file is ready:', convertedAudioPath)

// 			// Check audio duration – reject if 20 seconds or more.
// 			const audioDuration = await checkAudioDuration(convertedAudioPath)
// 			if (audioDuration >= 20) {
// 				fs.unlinkSync(convertedAudioPath)
// 				msg.reply(
// 					'Desculpa, mas por enquanto eu ainda não posso ouvir áudios com 20 segundos ou mais. Vamos tentar de novo?'
// 				)
// 				return
// 			}

// 			// Transcribe audio to text.
// 			const transcription = await transcribeAudioWithWhisper(convertedAudioPath)

// 			// Get assistant response using the voice message handler.
// 			const { assistantMessageId, runId } = await OpenAIModule.handleAddVoiceMessageToThread(threadId, transcription)

// 			const userMessage = transcription
// 			const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)

// 			try {
// 				const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
// 				const audioMessage = await generateMariaVoiceMessage(generatedMariaAudioMessage, assistantResponse)
// 				msg.reply(assistantResponse)
// 				if (audioMessage) {
// 					msg.reply(MessageMedia.fromFilePath(generatedMariaAudioMessage))
// 					fs.unlinkSync(generatedMariaAudioMessage)
// 				}
// 				// Use the assistantId from OpenAIModule instead of process.env.OPENAI_ASSISTANT_ID.
// 				await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
// 				this.scheduleFeedback(chatId, msg)
// 			} catch (error) {
// 				console.error('Erro ao receber mensagem do Assistant:', error)
// 				msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// 			}
// 		} catch (error) {
// 			console.error('Error processing voice message:', error)
// 			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem de áudio. Tente novamente.')
// 		}
// 	}

// 	/**
// 	 * Handles a location message.
// 	 */
// 	async handleLocationMessage(msg, chatId, threadId, messageType) {
// 		let address = null
// 		try {
// 			address = await findAddress(msg.location.latitude, msg.location.longitude)
// 		} catch (error) {
// 			console.error('Error finding address:', error)
// 		}
// 		const userMessage = address
// 		try {
// 			const { assistantMessageId, runId } = await OpenAIModule.handleAddLocationMessageToThread(threadId, userMessage)
// 			const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)
// 			try {
// 				const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
// 				msg.reply(assistantResponse)
// 				await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
// 				this.scheduleFeedback(chatId, msg)
// 			} catch (error) {
// 				console.error('Erro ao receber mensagem do Assistant:', error)
// 				msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// 			}
// 		} catch (error) {
// 			console.error('Error processing location message:', error)
// 			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// 		}
// 	}

// 	/**
// 	 * Handles a text (default) message.
// 	 */
// 	async handleTextMessage(msg, chatId, threadId, messageType) {
// 		const userMessage = msg.body
// 		try {
// 			const { assistantMessageId, runId } = await OpenAIModule.handleAddMessageToThread(threadId, msg)
// 			const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)
// 			try {
// 				const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
// 				msg.reply(assistantResponse)
// 				await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
// 				this.scheduleFeedback(chatId, msg)
// 			} catch (error) {
// 				console.error('Erro ao receber mensagem do Assistant:', error)
// 				msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// 			}
// 		} catch (error) {
// 			console.error('Error processing text message:', error)
// 			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
// 		}
// 	}
// }

// module.exports = new WhatsAppClient()

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

	async handleVoiceMessage(msg, chatId, threadId, messageType) {
		console.log('Received audio message:', msg)
		try {
			const audioMedia = await msg.downloadMedia()
			console.log('Downloaded audio media:', audioMedia)

			const audioBuffer = Buffer.from(audioMedia.data, 'base64')
			const baseName = chatId.slice(0, 12)
			const audioPath = `./${baseName}-tempAudio.ogg`
			const convertedAudioPath = `./${baseName}-convertedAudio.mp3`
			const generatedMariaAudioMessage = `./${baseName}-generatedMariaAudio.mp3`

			fs.writeFileSync(audioPath, audioBuffer)
			probeInputFile(audioPath)
			console.log('Original audio file written to:', audioPath)

			await convertAudioToMp3(audioPath, convertedAudioPath)
			console.log('Converted audio file is ready:', convertedAudioPath)

			const audioDuration = await checkAudioDuration(convertedAudioPath)
			if (audioDuration >= 20) {
				fs.unlinkSync(convertedAudioPath)
				msg.reply(
					'Desculpa, mas por enquanto eu ainda não posso ouvir áudios com 20 segundos ou mais. Vamos tentar de novo?'
				)
				return
			}

			const transcription = await transcribeAudioWithWhisper(convertedAudioPath)
			const { assistantMessageId, runId } = await OpenAIModule.handleAddVoiceMessageToThread(threadId, transcription)
			const userMessage = transcription
			const userMessageId = await saveConversationState(chatId, userMessage, messageType, threadId)

			try {
				const assistantResponse = await OpenAIModule.getAssistantResponse(threadId, runId, assistantMessageId)
				const audioMessage = await generateMariaVoiceMessage(generatedMariaAudioMessage, assistantResponse)
				msg.reply(assistantResponse)
				if (audioMessage) {
					msg.reply(MessageMedia.fromFilePath(generatedMariaAudioMessage))
					fs.unlinkSync(generatedMariaAudioMessage)
				}
				await saveBotResponse(userMessageId, chatId, assistantResponse, threadId, OpenAIModule.assistantId)
				this.scheduleFeedback(chatId, msg)
			} catch (error) {
				console.error('Erro ao receber mensagem do Assistant:', error)
				msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem.')
			}
		} catch (error) {
			console.error('Error processing voice message:', error)
			msg.reply('Desculpe, ocorreu um erro ao processar sua mensagem de áudio. Tente novamente.')
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
