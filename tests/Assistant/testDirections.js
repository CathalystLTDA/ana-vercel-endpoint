// testDirections.js
require('dotenv').config() // Ensure OPENAI_API_KEY is loaded
const { OpenAI } = require('openai')
const { getTransitDirections } = require('../../app/src/utils/functions') // Use the real function implementation

// Helper to flatten structured message content into a single string.
function flattenMessageContent(content) {
	if (!Array.isArray(content)) return ''
	return content
		.map((block) => {
			if (block.type === 'text' && block.text) {
				return block.text.value
			}
			return `[${block.type} block]`
		})
		.join(' ')
}

class TransitTestModule {
	constructor() {
		this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
		// Use your Assistant ID as configured (ensure it has the updated tools/instructions)
		this.assistantId = process.env.ASSISTANT_ID || 'asst_bNjmliHgWjE380eAbjOK0j8c'
	}

	async createThread() {
		console.log('\n[createThread]: Creating a new thread...')
		try {
			const thread = await this.openai.beta.threads.create()
			console.log('[createThread]: Thread created with ID:', thread.id)
			return thread.id
		} catch (error) {
			console.error('[createThread]: Error creating thread:', error)
			throw error
		}
	}

	async handleUserMessage(threadId, userMessage) {
		console.log(`\n[handleUserMessage]: Adding user message to thread ${threadId}`)
		console.log('User message:', userMessage)
		try {
			// 1) Add the user's message to the thread.
			await this.openai.beta.threads.messages.create(threadId, {
				role: 'user',
				content: userMessage,
			})
		} catch (error) {
			console.error('[handleUserMessage]: Error adding user message:', error)
			throw error
		}

		console.log('[handleUserMessage]: Creating run...')
		let run
		try {
			// 2) Initiate a run using the assistant.
			run = await this.openai.beta.threads.runs.createAndPoll(threadId, {
				assistant_id: this.assistantId,
			})
			console.log('[handleUserMessage]: Run created. Status:', run.status)
		} catch (error) {
			console.error('[handleUserMessage]: Error creating run:', error)
			throw error
		}

		// 3) Poll the run until it is completed (or tool calls are handled).
		return await this.handleRunStatus(threadId, run)
	}

	async handleRunStatus(threadId, run) {
		console.log('\n[handleRunStatus]: Current run status:', run.status)

		// If the run is completed, retrieve and return the final assistant text.
		if (run.status === 'completed') {
			try {
				const messages = await this.openai.beta.threads.messages.list(threadId)
				console.log('[handleRunStatus]: Retrieved thread messages:')
				messages.data.forEach((msg, index) => {
					console.log(`  [${msg.role}]`, flattenMessageContent(msg.content))
				})
				// Assume the final assistant message is the last message with role 'assistant'
				const finalMessage = messages.data.filter((m) => m.role === 'assistant').pop()
				const finalText = flattenMessageContent(finalMessage.content)
				console.log('\n[handleRunStatus]: Final assistant message:\n', finalText)
				return finalText
			} catch (error) {
				console.error('[handleRunStatus]: Error retrieving final message:', error)
				throw error
			}
		}

		// If the run requires action (i.e. a tool call), process it.
		if (run.status === 'requires_action') {
			if (
				run.required_action &&
				run.required_action.submit_tool_outputs &&
				run.required_action.submit_tool_outputs.tool_calls
			) {
				const toolCalls = run.required_action.submit_tool_outputs.tool_calls
				console.log('[handleRunStatus]: Model invoked tool calls:')
				console.log(toolCalls)

				const toolOutputs = []
				// Loop through each tool call. In our case, we expect getTransitDirections.
				for (const toolCall of toolCalls) {
					const fnName = toolCall.function.name
					let fnArgs = {}
					try {
						fnArgs = JSON.parse(toolCall.function.arguments || '{}')
					} catch (e) {
						console.error('[handleRunStatus]: Error parsing tool call arguments:', e)
					}
					console.log(`\n[handleRunStatus]: Executing function "${fnName}" with arguments:`, fnArgs)
					let result
					try {
						if (fnName === 'getTransitDirections') {
							// This call now uses the real API call to HERE via our functions module.
							result = await getTransitDirections(fnArgs.origin, fnArgs.destination)
						} else {
							result = { error: `No implementation for function ${fnName}` }
						}
						console.log('[handleRunStatus]: Function result:', result)
					} catch (error) {
						console.error(`[handleRunStatus]: Error executing function "${fnName}":`, error)
						result = { error: error.message }
					}
					toolOutputs.push({
						tool_call_id: toolCall.id,
						output: JSON.stringify(result),
					})
				}

				if (toolOutputs.length > 0) {
					console.log('[handleRunStatus]: Submitting tool outputs...')
					try {
						run = await this.openai.beta.threads.runs.submitToolOutputsAndPoll(threadId, run.id, {
							tool_outputs: toolOutputs,
						})
						console.log('[handleRunStatus]: New run status after submitting tool outputs:', run.status)
					} catch (error) {
						console.error('[handleRunStatus]: Error submitting tool outputs:', error)
						throw error
					}
					return await this.handleRunStatus(threadId, run)
				}
			}
		}

		console.warn('[handleRunStatus]: Unexpected run status:', run.status)
		return ''
	}
}

;(async () => {
	try {
		const testModule = new TransitTestModule()
		console.log('\n[testDirections.js]: Starting real test using the actual transit directions API...')

		// 1. Create a new thread.
		const threadId = await testModule.createThread()

		// 2. Ask the question that should trigger getTransitDirections.
		const userQuestion = 'Como eu vou da Avenida França 817 para a PUCRS em Porto Alegre?'
		console.log('\n[testDirections.js]: Sending user question:\n', userQuestion)

		// 3. Get the final answer from the assistant.
		const finalAnswer = await testModule.handleUserMessage(threadId, userQuestion)
		console.log('\n[testDirections.js]: Final answer from assistant:\n', finalAnswer)
	} catch (err) {
		console.error('[testDirections.js]: Error during test:', err)
	}
})()
