// src/utils/conversationStateManager.js
const prisma = require('../modules/database');

async function saveConversationState(chatIdString, messageContent, messageType, threadId = null, incrementMessageCount = true) {
    // Garantir a existência de um UserState
    const updateData = {
        ...incrementMessageCount ? { messageCount: { increment: 1 } } : {},
        ...(threadId ? { threadId: threadId } : {})
    };

    await prisma.userState.upsert({
        where: { chatId: chatIdString },
        update: updateData,
        create: {
            chatId: chatIdString,
            threadId: threadId
        }
    });

    // Criar uma nova mensagem e retornar seu ID
    const message = await prisma.message.create({
        data: {
            userState: { connect: { chatId: chatIdString } },
            content: messageContent,
            messageType: messageType,
            receivedAt: new Date(),
            threadId: threadId
        }
    });

    return message.id; // Retorna o ID da mensagem
}

async function saveBotResponse(userMessageId, chatIdString, botMessageContent, threadId, assistantId) {
    // Verificar se a mensagem existe
    const messageExists = await prisma.message.findUnique({
        where: { id: userMessageId }
    });

    if (!messageExists) {
        console.error("Mensagem com ID não encontrada:", userMessageId);
        return;
    }

    await prisma.botResponse.create({
        data: {
            respondingTo: { connect: { id: userMessageId } },
            userState: { connect: { chatId: chatIdString } },
            content: botMessageContent,
            threadId: threadId,
            sentAt: new Date(),
            assistantId: assistantId,
            responseType: "text"
        }
    });
}

module.exports = {
    saveConversationState,
    saveBotResponse
};