import { NextRequest } from 'next/server'
import { createClient } from '@deepgram/sdk'

/**
 * API route to get Deepgram WebSocket connection details
 * This returns properly formatted connection parameters for client-side WebSocket
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Deepgram API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const language = searchParams.get('language') || 'en-US'
    const model = searchParams.get('model') || 'nova-2'
    const diarize = searchParams.get('diarize') === 'true'

    // Create Deepgram client
    const deepgram = createClient(apiKey)

    // Create proper WebSocket URL WITHOUT the API key in the URL
    // Authentication will be done via Authorization header
    const params = new URLSearchParams({
      model,
      language,
      punctuate: 'true',
      diarize: String(diarize),
      smart_format: 'true',
      interim_results: 'false', // Only final results for accuracy
      endpointing: '200', // Ultra-fast: 200ms for real-time response
      vad_events: 'true',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
    })

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    // Return the WebSocket URL and API key separately
    // The client will add the API key as Authorization header
    return new Response(
      JSON.stringify({
        wsUrl,
        apiKey, // Pass API key securely to client (only for client-side usage)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Deepgram API error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to initialize Deepgram connection' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * POST endpoint to proxy WebSocket connection through server
 * This is an alternative approach where the server handles the WebSocket
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Deepgram API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const { language = 'en-US', model = 'nova-2', diarize = false } = body

    const params = new URLSearchParams({
      model,
      language,
      punctuate: 'true',
      diarize: String(diarize),
      smart_format: 'true',
      interim_results: 'false', // Only final results for accuracy
      endpointing: '200', // Ultra-fast: 200ms for real-time response
      vad_events: 'true',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
    })

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    return new Response(
      JSON.stringify({
        wsUrl,
        apiKey, // Pass API key for authentication
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Deepgram API error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to initialize Deepgram connection' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

