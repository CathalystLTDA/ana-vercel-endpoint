// OpenAIModule.js
const { OpenAI } = require('openai')
const prisma = require('../../modules/database')
const { getTransitDirections } = require('../../utils/functions') // adjust the path as needed
require('dotenv').config()

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	defaultHeaders: {
		'OpenAI-Beta': 'assistants=v2',
	},
})

class OpenAIModule {
	constructor() {
		this.openai = openai
		this.assistantId = process.env.ASSISTANT_ID || 'asst_Lpc5taxnpowDuMOfOZeiSvkM'
		this.pollInterval = 1500 // milliseconds
	}

	/**
	 * Creates a new thread using the OpenAI API.
	 * @returns {Promise<string>} The thread ID.
	 */
	async createThread() {
		try {
			const thread = await this.openai.beta.threads.create()
			return thread.id
		} catch (error) {
			console.error('Error creating thread in OpenAI:', error)
			throw error
		}
	}

	/**
	 * Saves a message into the database.
	 */
	async saveMessage(chatId, state, messageContent, threadId) {
		// Upsert UserState (create or update)
		await prisma.userState.upsert({
			where: { chatId },
			update: { threadId },
			create: { chatId, threadId },
		})
		try {
			const message = await prisma.message.create({
				data: {
					userState: { connect: { chatId } },
					content: messageContent,
					messageType: 'chat',
					receivedAt: state.lastAssistantMessageTimestamp ? new Date(state.lastAssistantMessageTimestamp) : new Date(),
					threadId,
				},
			})
			return message.id
		} catch (error) {
			console.error('Error saving message:', error)
			throw error
		}
	}

	/**
	 * Polls the run until it is completed.
	 * If the run requires action (i.e. function calls), executes them and submits outputs.
	 */
	async pollRunUntilCompleted(threadId, run) {
		while (run.status !== 'completed') {
			if (run.status === 'requires_action') {
				if (
					run.required_action &&
					run.required_action.submit_tool_outputs &&
					run.required_action.submit_tool_outputs.tool_calls
				) {
					const toolCalls = run.required_action.submit_tool_outputs.tool_calls
					const toolOutputs = []
					for (const toolCall of toolCalls) {
						const fnName = toolCall.function.name
						let fnArgs = {}
						try {
							fnArgs = JSON.parse(toolCall.function.arguments || '{}')
						} catch (e) {
							console.error('Error parsing tool call arguments:', e)
						}
						let result
						try {
							result = await this._executeFunctionCall(fnName, fnArgs)
						} catch (error) {
							console.error(`Error executing function ${fnName}:`, error)
							result = { error: error.message }
						}
						toolOutputs.push({
							tool_call_id: toolCall.id,
							output: JSON.stringify(result),
						})
					}
					// Submit all tool outputs and poll again.
					run = await this.openai.beta.threads.runs.submitToolOutputsAndPoll(threadId, run.id, {
						tool_outputs: toolOutputs,
					})
				}
			}
			await new Promise((resolve) => setTimeout(resolve, this.pollInterval))
			run = await this.openai.beta.threads.runs.retrieve(threadId, run.id)
		}
		return run
	}

	/**
	 * Retrieves the final assistant response text.
	 * This method polls the run until completion (handling any function calls)
	 * and then retrieves the final text message from the thread.
	 */
	async getAssistantResponse(threadId, runId, assistantMessageId) {
		try {
			let run = await this.openai.beta.threads.runs.retrieve(threadId, runId)
			run = await this.pollRunUntilCompleted(threadId, run)
			const messages = await this.openai.beta.threads.messages.list(threadId)
			// Filter for the final assistant message (adjust if your schema differs)
			const finalMessage = messages.data.filter((m) => m.role === 'assistant').pop()
			// Assume the response is in the first text block
			return finalMessage.content[0].text.value
		} catch (error) {
			console.error('Error retrieving assistant response:', error)
			throw error
		}
	}

	/**
	 * Ensures a valid thread exists for the given chat.
	 */
	async ensureThreadId(chatId) {
		const userState = await prisma.userState.findUnique({ where: { chatId } })
		if (!userState || !userState.threadId) {
			// No thread exists, so create one.
			const newThread = await this.openai.beta.threads.create()
			const newThreadId = newThread?.id
			await prisma.userState.upsert({
				where: { chatId },
				update: { threadId: newThreadId },
				create: { chatId, threadId: newThreadId },
			})
			return newThreadId
		}

		// Validate the stored thread.
		try {
			const existingThread = await this.openai.beta.threads.retrieve(userState.threadId)
			return existingThread.id
		} catch (error) {
			// If the error indicates the thread no longer exists (404), create a new thread.
			if (error.status === 404 || (error.error && error.error.message.includes('No thread found'))) {
				console.warn(`Thread ${userState.threadId} not found. Creating a new thread for chatId ${chatId}.`)
				const newThread = await this.openai.beta.threads.create()
				const newThreadId = newThread?.id
				await prisma.userState.upsert({
					where: { chatId },
					update: { threadId: newThreadId },
					create: { chatId, threadId: newThreadId },
				})
				return newThreadId
			}
			throw error
		}
	}

	/**
	 * Private helper: Adds a message to a thread and creates a run.
	 */
	async _handleMessageAndRun(threadId, content) {
		await this.openai.beta.threads.messages.create(threadId, {
			role: 'user',
			content,
		})
		const run = await this.openai.beta.threads.runs.create(threadId, {
			assistant_id: this.assistantId,
		})
		// We return the run ID; the final assistant text will be obtained later.
		return { assistantMessageId: null, runId: run.id }
	}

	/**
	 * Handles adding a text message.
	 */
	async handleAddMessageToThread(threadId, msg) {
		return this._handleMessageAndRun(threadId, msg.body)
	}

	/**
	 * Handles adding a voice (transcribed) message.
	 */
	async handleAddVoiceMessageToThread(threadId, transcription) {
		return this._handleMessageAndRun(threadId, transcription)
	}

	/**
	 * Handles adding a location message.
	 */
	async handleAddLocationMessageToThread(threadId, location) {
		return this._handleMessageAndRun(threadId, location)
	}

	/**
	 * Executes a local function corresponding to the model’s tool call.
	 * Currently supports 'getTransitDirections'.
	 */
	async _executeFunctionCall(fnName, fnArgs) {
		if (fnName === 'getTransitDirections') {
			return await getTransitDirections(fnArgs.origin, fnArgs.destination)
		} else {
			throw new Error(`Function not implemented: ${fnName}`)
		}
	}
}

module.exports = new OpenAIModule()
