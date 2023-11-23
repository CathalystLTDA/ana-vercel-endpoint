// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const { OpenAI } = require('openai');
const fs = require('fs'); 
// const qrcode = require('qrcode-terminal');
const ffmpeg = require('fluent-ffmpeg');
// const whatsappModule = require('./src/modules/whatsapp/WhatsAppClient');


// const RATE_LIMIT_PERIOD = 2000; // 24 hours in milliseconds
const RATE_LIMIT_PERIOD = 24 * 60 * 60 * 1000
const MAX_MESSAGES_PER_PERIOD = 2; // Max messages allowed in the period

// const client = new Client({ authStrategy: new LocalAuth() });

// const openai = new OpenAI();

// async function addMessageToThread(chatId, message, role) {
//     const threadId = conversationStates[chatId].threadId;
//     await openai.beta.threads.messages.create(threadId, { 
//         role: role, 
//         content: message 
//     });
// }

// async function saveThreadContentAndDelete(threadId, filePath) {
//     try {
//         // Fetch all messages from the thread
//         const messagesList = await openai.beta.threads.messages.list(threadId);
//         console.log(messagesList)
//         // Write messages to a JSON file
//         await fs.writeFile(filePath, JSON.stringify(messagesList, null, 2));

//         // Delete the thread
//         await openai.beta.threads.delete(threadId);

//         console.log(`Thread content saved to ${filePath} and thread deleted.`);
//     } catch (error) {
//         console.error(`Error processing thread ${threadId}:`, error);
//     }
// }

// async function getAssistantResponse(chatId, threadId, assistantId) {
//     try {
//         const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });

//         return new Promise((resolve, reject) => {
//             conversationStates[chatId].intervalId = setInterval(async () => {
//                 try {
//                     const runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

//                     if (runStatus.status === "completed") {
//                         const messagesList = await openai.beta.threads.messages.list(threadId);

//                         for (let i = messagesList.data.length - 1; i >= 0; i--) {
//                             const msg = messagesList.data[i];
//                             if (msg.role === 'assistant' && new Date(msg.created_at).getTime() > conversationStates[chatId].lastAssistantMessageTimestamp) {
//                                 // Update the timestamp and resolve with the new message
//                                 conversationStates[chatId].lastAssistantMessageTimestamp = new Date(msg.created_at).getTime();
//                                 clearInterval(conversationStates[chatId].intervalId);
//                                 conversationStates[chatId].isRunActive = false;
//                                 resolve(msg.content[0].text.value);
//                                 break;
//                             }
//                         }
//                     }
//                 } catch (error) {
//                     clearInterval(conversationStates[chatId].intervalId);
//                     reject(error);
//                 }
//             }, 2500); // Adjust this interval as necessary
//         });

//     } catch (error) {
//         cleanupConversationState(chatId);
//         throw error; // Rethrow the error to handle it in the calling function
//     }
// }

async function handleOpenAIInteraction(msg, transcription) {
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
        content: msg.body || transcription
    });

}

// Cleanup function to reset conversation state
// function cleanupConversationState(chatId) {
//     if (conversationStates[chatId]) {
//         clearInterval(conversationStates[chatId].intervalId);
//         conversationStates[chatId] = null;
//     }
// }

// async function waitForRunCompletion(threadId, runId) {
//     return new Promise((resolve, reject) => {
//         const intervalId = setInterval(async () => {
//             try {
//                 const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
//                 if (runStatus.status === "completed") {
//                     clearInterval(intervalId);
//                     resolve();
//                 }
//             } catch (error) {
//                 clearInterval(intervalId);
//                 reject(error);
//             }
//         }, 1000); // Check every second, adjust as needed
//     });
// }

// async function ensureThreadId(chatId) {
//     if (!conversationStates[chatId] || !conversationStates[chatId].threadId) {
//         // If there's no conversation state or threadId for this chatId, create a new thread
//         console.log(`No valid threadId for chat ${chatId}, creating a new thread.`);
//         const thread = await openai.beta.threads.create();
//         console.log("New thread created with ID:", thread.id);

//         // Initialize or update the conversation state
//         conversationStates[chatId] = {
//             ...conversationStates[chatId],
//             threadId: thread.id,
//             lastAssistantMessageTimestamp: 0 // Initialize the timestamp if not already present
//         };
//     }
// }

// async function convertAudioToMp3(inputPath, outputPath) {
//     return new Promise((resolve, reject) => {
//         ffmpeg(inputPath)
//             .toFormat('mp3')
//             .on('end', () => {
//                 fs.unlinkSync(inputPath); // Delete the original file
//                 resolve(outputPath);
//             })
//             .on('error', (err) => reject(err))
//             .saveToFile(outputPath);
//     });
// }

// async function transcribeAudioWithWhisper(filePath) {
//     const transcription = await openai.audio.transcriptions.create({
//         file: fs.createReadStream(filePath),
//         model: "whisper-1",
//     });

//     fs.unlinkSync(filePath); // Delete the converted MP3 file
//     return transcription.text;
// }

async function checkAndUpdateRateLimit(chatId, now) {

    // Check if state exists and add new properties if they're missing
    if (conversationStates[chatId]) {
        if (conversationStates[chatId].blocked === undefined) {
            conversationStates[chatId].blocked = false;
            conversationStates[chatId].messageCount = 1;
            conversationStates[chatId].timestamp = now;
        }
        // Add checks for any other new properties here
    } else {
        // Initialize state for new chat
        conversationStates[chatId] = {
            messageCount: 1,
            timestamp: now,
            blocked: false,
            threadId: '', // Initialize with empty string or appropriate value
            lastAssistantMessageTimestamp: 0
        };
    }

    let state = conversationStates[chatId];
    console.log(`Current state: ${JSON.stringify(state)}`);

    if (state.blocked) {
        if (now - state.timestamp > RATE_LIMIT_PERIOD) {
            // Reset the state after the period
            state.messageCount = 1;
            state.timestamp = now;
            state.blocked = false;
            console.log(`Block period ended, resetting state: ${JSON.stringify(state)}`);
            return { allowed: true, timeLeft: 0 };
        } else {
            let timeLeft = RATE_LIMIT_PERIOD - (now - state.timestamp);
            console.log(`User is still blocked, time left: ${timeLeft}`);
            return { allowed: false, timeLeft: timeLeft };
        }
    } else {
        if (state.messageCount >= MAX_MESSAGES_PER_PERIOD) {
            state.blocked = true;
            state.timestamp = now;
            console.log(`User has hit the limit, blocking: ${JSON.stringify(state)}`);
            const threadId = conversationStates[chatId].threadId; // Replace with your thread ID
            const filePath = `./${conversationStates[chatId].threadId}.json`; // Replace with your desired file path
            await saveThreadContentAndDelete(threadId, filePath);
            return { allowed: false, timeLeft: RATE_LIMIT_PERIOD };
        }
        state.messageCount++;
        console.log(`Incrementing message count: ${JSON.stringify(state)}`);
        return { allowed: true, timeLeft: 0 };
    }
}

// // Client message event listener
// client.on('message', async msg => {
//     let rateLimitCheck = checkAndUpdateRateLimit(chatId, now, currentState);
//     if (!rateLimitCheck.allowed) {
//         client.sendMessage(msg.from, `You have exceeded the message limit.`);
//         return;
//     }

//     await ensureThreadId(chatId);


//     if (pushname === 'Tobias Sartori' || pushname === 'Mateus Vidaletti' ) {
//        if (msg.type === 'sticker') {
//         console.log('Received a sticker from', msg.from);
//         client.sendMessage(msg.from, "Desculpa, mas não sou capaz de responder adesivos!");
//         return;
//        }

//         if (msg.type === 'ptt') {
//                 try {
//                     const audioMedia = await msg.downloadMedia();
//                     const audioBuffer = Buffer.from(audioMedia.data, 'base64');
//                     const audioPath = `./tempAudio.oga`; // OGG format file
//                     const convertedAudioPath = `./convertedAudio.mp3`; // Target MP3 format file

//                     fs.writeFileSync(audioPath, audioBuffer);

//                     // Convert audio to MP3
//                     await convertAudioToMp3(audioPath, convertedAudioPath);

//                     // Transcribe audio
//                     const transcription = await transcribeAudioWithWhisper(convertedAudioPath);
//                     console.log(`Transcription: ${transcription}`);
//                     await handleOpenAIInteraction(msg, transcription);

//                     // Process and respond to the transcribed text
//                     const assistantResponse = await getAssistantResponse(chatId, conversationStates[chatId].threadId, MARIA_ID);
//                     msg.reply(assistantResponse);

//                 } catch (error) {
//                     console.error('Error processing voice message:', error);
//                 }
//         } else {
//             await handleOpenAIInteraction(msg);
            
//                 // For other message types, process and respond directly with the message body
//                 try {
//                     const assistantResponse = await getAssistantResponse(chatId, conversationStates[chatId].threadId, MARIA_ID);
//                     msg.reply(assistantResponse);
//                 } catch (error) {
//                     console.error(`Error retrieving response for ${chatId}:`, error);
//                     // Handle error appropriately
//                 }
//             }
//     }    
// });

const whatsappClient = require('./src/modules/whatsapp/WhatsAppClient');

whatsappClient.init()
    .then(() => {
        console.log('WhatsApp client succesfully initialized. Hello, MARIA!');
    })
    .catch((error) => {
        console.error('Failed to initialize WhatsApp client', error);
    });

//NEXT STEPS:

// handle images
// handle voice messages