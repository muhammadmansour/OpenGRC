/**
 * Chat Service
 * Handles AI chat and streaming responses
 */

const config = require('../config');
const authService = require('./auth.service');

class ChatService {
  /**
   * Send chat message and get streaming response
   */
  async streamChat(userInput, documentIds, conversationId) {
    const hasValidToken = await authService.ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Authentication failed - unable to obtain valid token');
    }

    const queryParams = new URLSearchParams();
    if (documentIds && documentIds.length > 0) {
      queryParams.append('document_ids', documentIds.join(','));
    }
    queryParams.append('agent', 'RerankingRetrieveGenerate');
    if (conversationId) {
      queryParams.append('conversation_id', conversationId);
    }

    const requestUrl = `${config.llmApiUrl}/v1/experimental/chat-stream?${queryParams.toString()}`;

    console.log('📤 Starting chat stream:', {
      url: requestUrl,
      documentIds,
      conversationId
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${authService.getAccessToken()}`,
        'userid': authService.getUserId()
      },
      body: JSON.stringify({
        user_input: userInput,
        agent_config: {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat stream failed: ${response.status} - ${errorText}`);
    }

    return response;
  }

  /**
   * Non-streaming chat message
   */
  async sendMessage(userInput, documentIds, conversationId) {
    const queryParams = new URLSearchParams();
    if (documentIds && documentIds.length > 0) {
      queryParams.append('document_ids', documentIds.join(','));
    }
    queryParams.append('agent', 'RerankingRetrieveGenerate');
    if (conversationId) {
      queryParams.append('conversation_id', conversationId);
    }

    const response = await authService.makeAuthenticatedRequest(
      `${config.llmApiUrl}/v1/experimental/chat?${queryParams.toString()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_input: userInput,
          agent_config: {}
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat message failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Parse streaming response line
   */
  parseStreamLine(line) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return null;

    try {
      return JSON.parse(trimmedLine);
    } catch (error) {
      console.warn('Failed to parse streaming chunk:', trimmedLine);
      return null;
    }
  }

  /**
   * Process stream message and extract content
   */
  processStreamMessage(parsedData, streamState) {
    // Handle final stream object with step "Finished"
    if (parsedData.step === 'Finished') {
      if (parsedData.content?.chatbot_message) {
        const chatbotMessage = parsedData.content.chatbot_message;
        streamState.finalChatbotMessage = typeof chatbotMessage.content === 'string' 
          ? chatbotMessage.content 
          : JSON.stringify(chatbotMessage.content);
        streamState.finalChatbotMessageObject = chatbotMessage;
        streamState.fullResponse = streamState.finalChatbotMessage;
        
        if (chatbotMessage.cmetadata?.citations_data) {
          streamState.citationsData = chatbotMessage.cmetadata.citations_data;
        }
      }
      return { finished: true };
    }

    // Handle conversation ID
    if (parsedData.conversation_id && !streamState.conversationId) {
      streamState.conversationId = parsedData.conversation_id;
    }

    // Handle content chunks
    if (parsedData.content_delta) {
      const delta = typeof parsedData.content_delta === 'object' 
        ? JSON.stringify(parsedData.content_delta) 
        : parsedData.content_delta;
      streamState.fullResponse += delta;
      return { delta };
    } else if (parsedData.content) {
      const content = typeof parsedData.content === 'object' 
        ? JSON.stringify(parsedData.content) 
        : parsedData.content;
      streamState.fullResponse += content;
      return { delta: content };
    }

    // Handle language detection
    if (parsedData.detected_language && !streamState.detectedLanguage) {
      streamState.detectedLanguage = parsedData.detected_language;
      return { languageDetected: parsedData.detected_language };
    }

    // Handle completion
    if (parsedData.is_complete || parsedData.done) {
      return { finished: true };
    }

    return null;
  }
}

// Singleton instance
const chatService = new ChatService();

module.exports = chatService;
