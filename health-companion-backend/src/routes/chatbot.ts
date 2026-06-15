import express from 'express';
import { chatDb } from '../database';
import { ApiResponse, ChatMessage } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    // Chat history database storage is disabled. Always return empty list.
    const response: ApiResponse<ChatMessage[]> = {
      success: true,
      data: [],
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chat messages' } as ApiResponse<null>);
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { message, history }: { message: string; history?: Array<{ role: 'user' | 'ai'; text: string }> } = req.body;

    if (!userId || !message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' } as ApiResponse<null>);
    }

    // We do NOT save the message to the database anymore.
    // Call generateBotResponse passing the in-memory history context.
    const botResponse = await generateBotResponse(userId, message.trim(), history);

    const response: ApiResponse<{ reply: string }> = {
      success: true,
      data: { reply: botResponse },
      message: 'Message sent successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' } as ApiResponse<null>);
  }
});

router.delete('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    await chatDb.clearUserChat(userId);
    res.json({ success: true, message: 'Chat history cleared successfully' } as ApiResponse<null>);
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ success: false, error: 'Failed to clear chat history' } as ApiResponse<null>);
  }
});

type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionPayload = {
  model: string;
  messages: ChatCompletionMessage[];
  temperature: number;
  max_completion_tokens?: number;
  max_tokens?: number;
};

type PreferredLanguage = 'english' | 'hindi';

async function generateBotResponse(
  userId: string,
  userMessage: string,
  clientHistory?: Array<{ role: 'user' | 'ai'; text: string }>
): Promise<string> {
  const preferredLanguage = detectPreferredLanguage(userMessage);

  try {
    // Map the in-memory history passed from the client
    const history: ChatCompletionMessage[] = clientHistory
      ? clientHistory.slice(-12).map((message) => ({
          role: message.role === 'user' ? 'user' : 'assistant',
          content: message.text,
        }))
      : [];

    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: getSystemPrompt(preferredLanguage),
      },
      ...history,
    ];

    const groqPayload: ChatCompletionPayload = {
      model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
      messages,
      max_completion_tokens: getNumberEnv('GROQ_MAX_TOKENS', 350),
      temperature: getNumberEnv('GROQ_TEMPERATURE', 0.5),
    };

    if (process.env.GROQ_API_KEY) {
      return await createChatCompletion({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY,
        payload: groqPayload,
        provider: 'Groq',
        fallbackMessage: userMessage,
        fallbackLanguage: preferredLanguage,
      });
    }

    if (process.env.OPENAI_API_KEY) {
      const openAiPayload: ChatCompletionPayload = {
        model: process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo',
        messages,
        max_tokens: getNumberEnv('OPENAI_MAX_TOKENS', 250),
        temperature: getNumberEnv('OPENAI_TEMPERATURE', 0.5),
      };

      return await createChatCompletion({
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY,
        payload: openAiPayload,
        provider: 'OpenAI',
        fallbackMessage: userMessage,
        fallbackLanguage: preferredLanguage,
      });
    }

    return generateFallbackResponse(userMessage, preferredLanguage);
  } catch (error) {
    console.error('AI provider error:', error);
    return generateFallbackResponse(userMessage, preferredLanguage);
  }
}

function getNumberEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function detectPreferredLanguage(userMessage: string): PreferredLanguage {
  const message = userMessage.toLowerCase();

  if (/[\u0900-\u097f]/.test(message)) {
    return 'hindi';
  }

  const hindiMarkers = [
    'aap',
    'apko',
    'mujhe',
    'mere',
    'mera',
    'meri',
    'kya',
    'kyu',
    'kaise',
    'hai',
    'hain',
    'ho',
    'raha',
    'rahi',
    'hota',
    'hoti',
    'karu',
    'batao',
    'madad',
    'tabiyat',
    'sehat',
    'bimar',
    'bimari',
    'bukhar',
    'khansi',
    'dard',
    'dawa',
    'davai',
    'dawaai',
    'ilaaj',
    'ilaj',
    'saans',
    'sans',
    'neend',
  ];

  return hindiMarkers.some((marker) => new RegExp(`\\b${marker}\\b`).test(message)) ? 'hindi' : 'english';
}

function getSystemPrompt(language: PreferredLanguage): string {
  return "You are a helpful, friendly, and empathetic general-purpose AI assistant. You can converse naturally in English, Hindi, or Hinglish. Feel free to chat, answer questions, write stories, explain concepts, help with code, and discuss any topic the user wants.";
}

async function createChatCompletion({
  url,
  apiKey,
  payload,
  provider,
  fallbackMessage,
  fallbackLanguage,
}: {
  url: string;
  apiKey: string;
  payload: Record<string, unknown>;
  provider: string;
  fallbackMessage: string;
  fallbackLanguage: PreferredLanguage;
}): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.warn(`${provider} response not OK`, response.status);
    throw new Error(`${provider} service returned an error`);
  }

  const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return result.choices?.[0]?.message?.content?.trim() || generateFallbackResponse(fallbackMessage, fallbackLanguage);
}

function generateFallbackResponse(userMessage: string, language: PreferredLanguage = detectPreferredLanguage(userMessage)): string {
  if (language === 'hindi') {
    return 'Main abhi network connection issue ki wajah se response nahi de pa raha hoon. Kripya thodi der baad phir se koshish karein.';
  }
  return 'I am currently unable to respond due to a network connection issue. Please try again in a moment.';
}

export { router as chatbotRouter };
