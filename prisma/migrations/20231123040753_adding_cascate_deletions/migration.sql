-- DropForeignKey
ALTER TABLE "BotResponse" DROP CONSTRAINT "BotResponse_chatId_fkey";

-- DropForeignKey
ALTER TABLE "BotResponse" DROP CONSTRAINT "BotResponse_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_chatId_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "UserState"("chatId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotResponse" ADD CONSTRAINT "BotResponse_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotResponse" ADD CONSTRAINT "BotResponse_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "UserState"("chatId") ON DELETE CASCADE ON UPDATE CASCADE;
