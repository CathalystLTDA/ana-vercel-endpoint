/*
  Warnings:

  - You are about to drop the `conversationstates` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "conversationstates";

-- CreateTable
CREATE TABLE "ConversationState" (
    "id" SERIAL NOT NULL,
    "chatId" INTEGER NOT NULL,
    "lastassistantmessagetimestamp" DATE NOT NULL,
    "message_content" TEXT NOT NULL,
    "thread" TEXT NOT NULL,
    "createdat" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedat" DATE NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chat_chatId_key" ON "Chat"("chatId");

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
