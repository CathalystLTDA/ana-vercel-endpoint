// updateAssistant.js
const { OpenAI } = require('openai')
require('dotenv').config()
;(async () => {
	try {
		const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

		// ID of your existing assistant on the platform:
		const assistantId = 'asst_bNjmliHgWjE380eAbjOK0j8c'

		// Update your assistant with function-calling tools
		const updatedAssistant = await client.beta.assistants.update(assistantId, {
			model: 'gpt-4o-mini',
			instructions: 'You are a transit bot. Use the provided function to give directions or answer queries.',
			tools: [
				{
					type: 'function',
					function: {
						name: 'getTransitDirections',
						description:
							'Fetches public transit directions between an origin and a destination using the HERE Geocoding and Routing API.',
						parameters: {
							type: 'object',
							properties: {
								origin: {
									type: 'string',
									description: "Starting address (e.g., 'Avenida França, 817, Porto Alegre')",
								},
								destination: {
									type: 'string',
									description: "Destination address (e.g., 'PUCRS, Porto Alegre')",
								},
							},
							required: ['origin', 'destination'],
							additionalProperties: false,
						},
						strict: true,
					},
				},
			],
		})

		console.log('Assistant updated successfully!')
		console.log('Assistant ID:', updatedAssistant.id)
		console.log('Updated Tools:', updatedAssistant.tools)
	} catch (error) {
		console.error('Error updating assistant:', error)
	}
})()
