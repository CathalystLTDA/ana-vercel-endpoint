const { Client, LocalAuth, MessageMedia, Buttons } = require('whatsapp-web.js');
const { OpenAI } = require('openai');
const fs = require('fs').promises; 
const qrcode = require('qrcode-terminal');

const client = new Client({ authStrategy: new LocalAuth() });
const openai = new OpenAI();

let conversationStates = {};

async function saveThreadContentAndDelete(threadId, filePath) {
    try {
        // Fetch all messages from the thread
        const messagesList = await openai.beta.threads.messages.list(threadId);

        // Write messages to a JSON file
        await fs.writeFile(filePath, JSON.stringify(messagesList, null, 2));

        // Delete the thread
        await openai.beta.threads.delete(threadId);

        console.log(`Thread content saved to ${filePath} and thread deleted.`);
    } catch (error) {
        console.error(`Error processing thread ${threadId}:`, error);
    }
}


async function getAssistantResponse(chatId, threadId, assistantId) {
    try {
        const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });

        return new Promise((resolve, reject) => {
            conversationStates[chatId].intervalId = setInterval(async () => {
                try {
                    const runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

                    if (runStatus.status === "completed") {
                        const messagesList = await openai.beta.threads.messages.list(threadId);

                        for (let i = messagesList.data.length - 1; i >= 0; i--) {
                            const msg = messagesList.data[i];
                            if (msg.role === 'assistant' && new Date(msg.created_at).getTime() > conversationStates[chatId].lastAssistantMessageTimestamp) {
                                // Update the timestamp and resolve with the new message
                                conversationStates[chatId].lastAssistantMessageTimestamp = new Date(msg.created_at).getTime();
                                clearInterval(conversationStates[chatId].intervalId);
                                conversationStates[chatId].isRunActive = false;
                                resolve(msg.content[0].text.value);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    clearInterval(conversationStates[chatId].intervalId);
                    reject(error);
                }
            }, 2500); // Adjust this interval as necessary
        });

    } catch (error) {
        cleanupConversationState(chatId);
        throw error; // Rethrow the error to handle it in the calling function
    }
}

async function handleOpenAIInteraction(msg) {
    const chatId = msg.from;

     if (conversationStates[chatId] && conversationStates[chatId].isRunActive) {
        console.log(`Run is still active for chat ${chatId}. Queuing message.`);
        // Queue the message or handle it according to your logic
        return;
    }

    let threadId; // Declare threadId outside the if-else scope
    let runId;

    // Check if a thread already exists for this chat
    if (conversationStates[chatId] && conversationStates[chatId].threadId) {
        threadId = conversationStates[chatId].threadId; // Use the existing thread ID
        console.log("Retrieved thread ID:", threadId);
    } else {
        const thread = await openai.beta.threads.create(); // Create a new thread
        console.log("Thread created with ID:", thread.id);
        threadId = thread.id; // Assign the new thread ID

        // Initialize or update the conversation state
        conversationStates[chatId] = {
            threadId: threadId,
            intervalId: null,
            lastAssistantMessageTimestamp: 0 // Initialize the timestamp
        };
    }

    conversationStates[chatId].isRunActive = true;

    if (conversationStates[chatId] && conversationStates[chatId].runId) {
        runId = conversationStates[chatId].runId;
        try {
            await waitForRunCompletion(threadId, runId);
        } catch (error) {
            console.error(`Error waiting for run completion for chat ${chatId}:`, error);
            // Handle error appropriately
            return;
        }
    }

    // Add the user's message to the thread
    const message = await openai.beta.threads.messages.create(threadId, { 
        role: "user", 
        content: msg.body 
    });

}

// Cleanup function to reset conversation state
function cleanupConversationState(chatId) {
    if (conversationStates[chatId]) {
        clearInterval(conversationStates[chatId].intervalId);
        conversationStates[chatId] = null;
    }
}

async function waitForRunCompletion(threadId, runId) {
    return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
            try {
                const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
                if (runStatus.status === "completed") {
                    clearInterval(intervalId);
                    resolve();
                }
            } catch (error) {
                clearInterval(intervalId);
                reject(error);
            }
        }, 1000); // Check every second, adjust as needed
    });
}


client.on('qr', (qr) => {
    console.log('QR RECEIVED');
    qrcode.generate(qr, { small: true })
});

client.on('authenticated', (session) => {
  console.log('AUTHENTICATED', session)
})

client.on('ready', () => {
    console.log('Client is ready!');
});

// Client message event listener
client.on('message', async msg => {
    const chatId = msg.from;
    const contact = await msg.getContact();
    const pushname = contact.pushname; 
    console.log(pushname)
    const getChatToCheckGroup = await msg.getChat()
    const preventGroup = getChatToCheckGroup.isGroup

    const MARIA_ID = "asst_Lpc5taxnpowDuMOfOZeiSvkM"

    if (preventGroup) {
        console.log("Message from group")
        return;
    }

    if (pushname === 'Gustavo Machado' || pushname === 'Amanda Lind' || pushname === "Pedro Pureza" || pushname === "Gisele Corrêa" || pushname === 'Matheus Homrich') {
        await handleOpenAIInteraction(msg);

       try {
            const assistantResponse = await getAssistantResponse(chatId, conversationStates[chatId].threadId, MARIA_ID);
            msg.reply(assistantResponse);
        } catch (error) {
            console.error(`Error retrieving response for ${chatId}:`, error);
            // Handle error appropriately
        }
    }

    if (msg.body === 'finish') {
        const threadId = conversationStates[chatId].threadId; // Replace with your thread ID
        const filePath = `./${conversationStates[chatId].threadId}.json`; // Replace with your desired file path
        await saveThreadContentAndDelete(threadId, filePath);
    }
});

//MARIA BOOT SEQUENCE
console.log("starting")
client.initialize();
// main();


