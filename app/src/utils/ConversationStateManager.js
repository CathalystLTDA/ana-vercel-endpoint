// // src/utils/conversationStateManager.js
// const prisma = require('../modules/database');

// async function saveConversationState(chatIdString, messageContent, messageType, threadId = null, incrementMessageCount = true) {
//     // Garantir a existência de um UserState
//     const updateData = {
//         ...incrementMessageCount ? { messageCount: { increment: 1 } } : {},
//         ...(threadId ? { threadId: threadId } : {})
//     };

//     await prisma.userState.upsert({
//         where: { chatId: chatIdString },
//         update: updateData,
//         create: {
//             chatId: chatIdString,
//             threadId: threadId
//         }
//     });

//     // Criar uma nova mensagem e retornar seu ID
//     const message = await prisma.message.create({
//         data: {
//             userState: { connect: { chatId: chatIdString } },
//             content: messageContent,
//             messageType: messageType,
//             receivedAt: new Date(),
//             threadId: threadId
//         }
//     });

//     return message.id; // Retorna o ID da mensagem
// }

// async function saveBotResponse(userMessageId, chatIdString, botMessageContent, threadId, assistantId) {
//     // Verificar se a mensagem existe
//     const messageExists = await prisma.message.findUnique({
//         where: { id: userMessageId }
//     });

//     if (!messageExists) {
//         console.error("Mensagem com ID não encontrada:", userMessageId);
//         return;
//     }

//     await prisma.botResponse.create({
//         data: {
//             respondingTo: { connect: { id: userMessageId } },
//             userState: { connect: { chatId: chatIdString } },
//             content: botMessageContent,
//             threadId: threadId,
//             sentAt: new Date(),
//             assistantId: assistantId,
//             responseType: "text"
//         }
//     });
// }

// module.exports = {
//     saveConversationState,
//     saveBotResponse
// };

// src/utils/conversationStateManager.js
// src/utils/conversationStateManager.js
const prisma = require('../modules/database')

/**
 * Ensures a UserState record for `chatIdString` exists (optionally incrementing message count)
 * and creates a Message record associated with that UserState.
 *
 * @param {string} chatIdString - Unique chat ID.
 * @param {string} messageContent - The content of the user's message.
 * @param {string} messageType - The type of the message (e.g., "chat", "image").
 * @param {string|null} threadId - The OpenAI thread ID (if available).
 * @param {boolean} incrementMessageCount - Whether to increment the message count.
 * @returns {Promise<string>} The newly created Message record's ID.
 */
async function saveConversationState(
	chatIdString,
	messageContent,
	messageType,
	threadId = null,
	incrementMessageCount = true
) {
	try {
		// 1. Prepare update data for UserState.
		const updateData = {
			...(incrementMessageCount ? { messageCount: { increment: 1 } } : {}),
			...(threadId ? { threadId } : {}),
		}

		// 2. Upsert the UserState.
		await prisma.userState.upsert({
			where: { chatId: chatIdString },
			update: updateData,
			create: { chatId: chatIdString, threadId },
		})

		// 3. Create a new Message.
		const message = await prisma.message.create({
			data: {
				// Do not include a standalone chatId field.
				userState: {
					connect: { chatId: chatIdString },
				},
				content: messageContent,
				messageType,
				receivedAt: new Date(),
				threadId,
			},
		})

		return message.id
	} catch (err) {
		console.error('Error saving conversation state', err)
		throw err
	}
}

/**
 * Saves the bot's response associated with a given user message.
 *
 * @param {string} userMessageId - The primary key of the user's message.
 * @param {string} chatIdString - The chat ID associated with the UserState.
 * @param {string} botMessageContent - The content of the bot's reply.
 * @param {string} threadId - The OpenAI thread ID.
 * @param {string} assistantId - The assistant's ID (if multiple AIs are used).
 * @returns {Promise<void>}
 */
async function saveBotResponse(userMessageId, chatIdString, botMessageContent, threadId, assistantId) {
	try {
		// Verify that the message exists.
		const messageExists = await prisma.message.findUnique({
			where: { id: userMessageId },
		})

		if (!messageExists) {
			console.error('Message not found with ID:', userMessageId)
			return
		}

		// Create a BotResponse linked to the user message.
		await prisma.botResponse.create({
			data: {
				respondingTo: { connect: { id: userMessageId } },
				userState: { connect: { chatId: chatIdString } },
				content: botMessageContent,
				threadId,
				sentAt: new Date(),
				assistantId,
				responseType: 'text',
			},
		})
	} catch (err) {
		console.error('Error saving bot response', err)
		throw err
	}
}

module.exports = {
	saveConversationState,
	saveBotResponse,
}
