const axios = require('axios')

// HERE API credentials (for testing purposes)
const HERE_API_KEY = 'nUV_cwMPZhilmo5VY3RoNvr0TJAl3wnmZXR7UYjQcF4'

/**
 * Geocodes an address using the HERE Geocoding API.
 * @param {string} address - The address to geocode.
 * @returns {Promise<{lat: number, lng: number}>} The latitude and longitude.
 */
async function geocodeAddress(address) {
	const geocodeUrl = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(
		address
	)}&apiKey=${HERE_API_KEY}`
	const response = await axios.get(geocodeUrl)
	if (response.data.items && response.data.items.length > 0) {
		const position = response.data.items[0].position
		return { lat: position.lat, lng: position.lng }
	} else {
		throw new Error(`No geocoding results for address: ${address}`)
	}
}

/**
 * Fetches public transit directions between an origin and a destination.
 * It first geocodes the addresses and then calls the HERE Routing API with transit mode.
 *
 * @param {string} origin - The starting address (e.g., "Avenida França, 817, Porto Alegre").
 * @param {string} destination - The destination address (e.g., "PUCRS, Porto Alegre").
 * @returns {Promise<Object>} An object with a summary of the route, duration, distance, and raw response.
 */
async function getTransitDirections(origin, destination) {
	// Geocode the origin and destination addresses.
	const originCoords = await geocodeAddress(origin)
	const destinationCoords = await geocodeAddress(destination)

	// Construct coordinate strings in "lat,lng" order.
	const originParam = `${originCoords.lat},${originCoords.lng}`
	const destinationParam = `${destinationCoords.lat},${destinationCoords.lng}`

	// Define additional parameters:
	const routingMode = 'fast'
	const departureTime = new Date().toISOString()

	// Build the HERE Routing API URL.
	const routingUrl = `https://router.hereapi.com/v8/routes?transportMode=publicTransport&routingMode=${routingMode}&departureTime=${encodeURIComponent(
		departureTime
	)}&origin=${originParam}&destination=${destinationParam}&return=summary&apikey=${HERE_API_KEY}`

	// Fetch transit route information.
	const routeResponse = await axios.get(routingUrl)
	if (routeResponse.data.routes && routeResponse.data.routes.length > 0) {
		// HERE returns routes broken into "sections". We assume the first section (or combine summaries) is our result.
		const sections = routeResponse.data.routes[0].sections
		// Create a combined summary from the sections.
		const summaryText = sections.map((section) => section.summary).join(' | ')
		// For simplicity, we return the duration and distance from the first section.
		return {
			summary: summaryText,
			duration: sections[0].summary.duration, // in seconds
			distance: sections[0].summary.length, // in meters
			raw: routeResponse.data,
		}
	} else {
		throw new Error('No transit route found.')
	}
}

module.exports = {
	getTransitDirections,
	geocodeAddress,
}
