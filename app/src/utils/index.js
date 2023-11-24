const fs = require('fs'); 
const ffmpeg = require('fluent-ffmpeg');
const { BASE_COOLDOWN, RATE_LIMIT, MAX_RATE_LIMIT_PERIOD } = require('../config')
const prisma = require('../modules/database');
const { OpenAI } = require('openai');

const openai = new OpenAI();

function runSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function convertAudioToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => {
                fs.unlinkSync(inputPath); // Delete the original file
                resolve(outputPath);
            })
            .on('error', (err) => reject(err))
            .saveToFile(outputPath);
    });
}

async function checkAudioDuration(outputPath) {
  return new Promise((resolve, reject) => {
    try { 
      ffmpeg.ffprobe(outputPath, function(err, metadata) {
        const duration = metadata.format.duration;
        resolve(duration)
        
        if (err) {
            console.error(err);
            reject(err)
            return;
        }
      });
    } catch (err) {
          reject(err)
          console.error(err)
    }
  });
}

async function transcribeAudioWithWhisper(filePath) {
    const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
    });

    fs.unlinkSync(filePath); // Delete the converted MP3 file
    return transcription.text;
}

async function checkRunStatusAndWait(threadId) {
  const runs = await openai.beta.threads.runs.list(
      threadId
  );

  for (let i = 0; i < runs.data.length; i++) {
    console.log(runs.data[i].status)
    if (runs.data[i].status !== "completed") {
      console.log("Run not finished")
      return true;
    }
    return false
  }
}

async function waitForRunCompletion(threadId, runId) {
    return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
            try {
                const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
                if (runStatus.status === "completed") {
                    const threadContent = await openai.beta.threads.messages.list(threadId);
                    let lastAssistantMessage = null;

                    for (let i = 0; i < threadContent.data.length; i++) {
                        if (threadContent.data[i].role === 'assistant') {
                            lastAssistantMessage = threadContent.data[i];
                            break
                        }
                    }
                    clearInterval(intervalId);
                    resolve(lastAssistantMessage.id);
                }
            } catch (error) {
                clearInterval(intervalId);
                reject(error);
            }
        }, 1000); // Check every second, adjust as needed
    });
}

async function checkAndUpdateRateLimit(chatId) {
  const userState = await prisma.userState.findUnique({
    where: { chatId: chatId },
  });

  if (!userState) {
    // Tratar erro: Estado do usuário não encontrado.
    return 'UserStateNotFound';
  }

  // Cálculo do tempo de cooldown com base no cooldownCount
  let cooldownTime = BASE_COOLDOWN 
  if (userState.cooldownCount === 1) {
    cooldownTime
  } else {   
   cooldownTime = cooldownTime * Math.pow(2, userState.cooldownCount)
  }
  cooldownTime = Math.min(cooldownTime, MAX_RATE_LIMIT_PERIOD); // Máximo de 16 horas

  // Verificar se a última mensagem foi recebida há mais que o tempo de cooldown para resetar o rateLimit
  const lastMessage = await prisma.message.findFirst({
    where: { chatId: chatId },
    orderBy: { receivedAt: 'desc' },
  });

  if (lastMessage && lastMessage.receivedAt < new Date(Date.now() - cooldownTime)) {
    // Resetar rateLimit
    await prisma.userState.update({
      where: { chatId: chatId },
      data: { rateLimit: 1 },
    });
    return 'RateLimitReset';
  }

  // Incrementar rateLimit
  if (userState.isOnCooldown === false) { 
    await prisma.userState.update({
      where: { chatId: chatId },
      data: {
        rateLimit: { increment: 1 },
      },
    });
  }

  // Atualizar o userState após o incremento para obter o valor atualizado
  const updatedUserState = await prisma.userState.findUnique({
    where: { chatId: chatId },
  });

  if (updatedUserState.rateLimit >= RATE_LIMIT) {
    // Colocar o usuário em cooldown e incrementar cooldownCount
    if (userState.isOnCooldown !== true) {
      await prisma.userState.update({
        where: { chatId: chatId },
        data: {
          isOnCooldown: true,
          cooldownCount: { increment: 1 },
        },
      });
    }

    const timeLeft = new Date(Date.now() + cooldownTime) - new Date();

    // Converter milissegundos em horas, minutos e segundos
    const timeLeftSeconds = timeLeft / 1000;
    const hours = Math.floor(timeLeftSeconds / 3600);
    const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
    const seconds = Math.floor(timeLeftSeconds % 60);

    // Formatar para tornar legível
    const formattedTimeLeft = `${hours} horas, ${minutes} minutos e ${seconds} segundos`;

    return `CooldownActivated timeLeft: ${formattedTimeLeft}`;
  }

  // Caso padrão: rateLimit não atingido
  return 'Continue';
}

async function findAddress(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error('Não foi possível encontrar o endereço.');
        } else {
          // Retorna o endereço formatado
          const address = `Meu endereço atual é: ${data.address.road}, ${data.address.house_number} em ${data.address.city}, ${data.address.state}, ${data.address.country}`
          return address
        }
    } catch (error) {
        console.error('Erro ao buscar endereço:', error);
        return null;
    }
}

async function checkFirstMessage(chatId) {
  const checkIfUserExists = await prisma.userState.findUnique({
          where: { chatId: chatId }
  });

  if (!checkIfUserExists) {
    return true
  }

  return false
}

function isValidMessageType(messageType) {
    const acceptedMessageTypes = ['chat', 'ptt', 'text', 'location'];
    return acceptedMessageTypes.includes(messageType);
}

module.exports = {
    runSleep,
    convertAudioToMp3,
    transcribeAudioWithWhisper,
    waitForRunCompletion,
    checkAndUpdateRateLimit,
    checkAudioDuration,
    findAddress,
    checkRunStatusAndWait,
    checkFirstMessage,
    isValidMessageType
}

