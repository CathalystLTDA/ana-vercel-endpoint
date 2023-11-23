/*
  Warnings:

  - You are about to drop the `Chat` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConversationState" DROP CONSTRAINT "ConversationState_chatId_fkey";

-- DropTable
DROP TABLE "Chat";

-- DropTable
DROP TABLE "ConversationState";

-- CreateTable
CREATE TABLE "UserState" (
    "chatId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserState_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "threadId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotResponse" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "UserState"("chatId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotResponse" ADD CONSTRAINT "BotResponse_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotResponse" ADD CONSTRAINT "BotResponse_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "UserState"("chatId") ON DELETE RESTRICT ON UPDATE CASCADE;
