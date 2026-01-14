/**
 * Chat Routes
 * Handles AI chat and streaming endpoints
 */

const express = require('express');
const router = express.Router();
const chatService = require('../services/chat.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * POST /api/chat/stream
 * Stream AI chat response (Server-Sent Events)
 */
router.post('/stream', asyncHandler(async (req, res) => {
  const { userInput, documentIds, conversationId } = req.body;

  if (!userInput) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'userInput is required'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // Get streaming response from external API
    const response = await chatService.streamChat(
      userInput, 
      documentIds || [], 
      conversationId
    );

    // Stream state
    const streamState = {
      fullResponse: '',
      conversationId: null,
      detectedLanguage: null,
      finalChatbotMessage: null,
      finalChatbotMessageObject: null,
      citationsData: null
    };

    // Get reader from response body
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processChunk = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            // Send final response
            res.write(`data: ${JSON.stringify({
              type: 'complete',
              response: streamState.finalChatbotMessage || streamState.fullResponse,
              conversationId: streamState.conversationId,
              citationsData: streamState.citationsData
            })}\n\n`);
            res.end();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const parsedData = chatService.parseStreamLine(line);
            if (!parsedData) continue;

            const result = chatService.processStreamMessage(parsedData, streamState);
            
            if (result) {
              if (result.delta) {
                res.write(`data: ${JSON.stringify({ type: 'delta', content: result.delta })}\n\n`);
              }
              if (result.languageDetected) {
                res.write(`data: ${JSON.stringify({ type: 'language', language: result.languageDetected })}\n\n`);
              }
              if (result.finished) {
                // Will be handled after loop ends
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
      }
    };

    await processChunk();

  } catch (error) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}));

/**
 * POST /api/chat/message
 * Send non-streaming chat message
 */
router.post('/message', asyncHandler(async (req, res) => {
  const { userInput, documentIds, conversationId } = req.body;

  if (!userInput) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'userInput is required'
    });
  }

  const result = await chatService.sendMessage(
    userInput, 
    documentIds || [], 
    conversationId
  );

  res.json(result);
}));

module.exports = router;
