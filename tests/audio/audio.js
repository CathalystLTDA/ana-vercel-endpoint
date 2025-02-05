const fs = require("fs");
const path = require("path")
const { OpenAI } = require('openai');

const openai = new OpenAI();

const speechFile = path.resolve("./speech2.mp3");

async function main() {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: "nova",
    input: "Olá, eu me chamo MARIA! Que dia maravilhoso!",
  });
  console.log(speechFile);
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(speechFile, buffer);
}
main();