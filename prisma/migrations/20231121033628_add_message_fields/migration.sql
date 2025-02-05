-- CreateTable
CREATE TABLE "conversationstates" (
    "id" SERIAL NOT NULL,
    "chatid" TEXT,
    "lastassistantmessagetimestamp" DATE NOT NULL,
    "message_content" TEXT NOT NULL,
    "thread" TEXT NOT NULL,
    "createdat" DATE NOT NULL,
    "updatedat" DATE NOT NULL,

    CONSTRAINT "conversationstates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversationstates_chatid_key" ON "conversationstates"("chatid");
