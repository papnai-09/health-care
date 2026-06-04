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

    const messages = await chatDb.getByUserId(userId);
    const response: ApiResponse<ChatMessage[]> = {
      success: true,
      data: messages,
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
    const { message }: { message: string } = req.body;

    if (!userId || !message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' } as ApiResponse<null>);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      userId,
      role: 'user',
      text: message.trim(),
      timestamp: new Date().toISOString(),
    };
    await chatDb.addMessage(userMessage);

    const botResponse = await generateBotResponse(userId, message.trim());

    const botMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      userId,
      role: 'ai',
      text: botResponse,
      timestamp: new Date().toISOString(),
    };
    await chatDb.addMessage(botMessage);

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

async function generateBotResponse(userId: string, userMessage: string): Promise<string> {
  const preferredLanguage = detectPreferredLanguage(userMessage);

  try {
    if (!isHealthRelatedMessage(userMessage)) {
      return getOffTopicReply(preferredLanguage);
    }

    const history: ChatCompletionMessage[] = (await chatDb.getByUserId(userId)).slice(-12).map((message) => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    }));

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
  const languageInstruction =
    language === 'hindi'
      ? 'The user wrote in Hindi or Hinglish. Reply in simple Hindi/Hinglish. Do not switch to English unless a medical term is commonly used in English.'
      : 'The user wrote in English. Reply in clear English. Do not switch to Hindi.';

  return `${languageInstruction} You are a helpful medical assistant for MediCare AI. Only answer health, wellness, symptoms, medicines, doctors, appointments, medical reports, and healthcare questions. If the user asks anything unrelated to healthcare, politely refuse and ask for a health-related question in the same language. Give compassionate, simple, safe health guidance. Do not diagnose with certainty. For severe symptoms, emergencies, pregnancy concerns, chest pain, breathing difficulty, neurological symptoms, or persistent high fever, tell the user to contact a qualified doctor or emergency services.`;
}

function getOffTopicReply(language: PreferredLanguage): string {
  if (language === 'hindi') {
    return 'Main sirf health, wellness, doctors, appointments, medicines, symptoms, reports, aur medical guidance se related questions me help kar sakta hoon. Please apna health-related question puchiye.';
  }

  return 'I can only help with health, wellness, doctors, appointments, medicines, symptoms, reports, and medical guidance. Please ask a health-related question.';
}

function isHealthRelatedMessage(userMessage: string): boolean {
  const message = userMessage.toLowerCase().replace(/\s+/g, ' ').trim();

  const conversationalOnly = /^(hi|hello|hey|namaste|thanks|thank you|shukriya|dhanyavaad|ok|okay|help|madad)$/i;
  if (conversationalOnly.test(message)) {
    return true;
  }

  const healthKeywords = [
    'health',
    'medical',
    'doctor',
    'patient',
    'appointment',
    'hospital',
    'clinic',
    'symptom',
    'medicine',
    'medication',
    'tablet',
    'dose',
    'prescription',
    'report',
    'record',
    'lab',
    'test',
    'vaccine',
    'vaccination',
    'fever',
    'temperature',
    'cold',
    'cough',
    'throat',
    'headache',
    'pain',
    'ache',
    'injury',
    'wound',
    'infection',
    'allergy',
    'rash',
    'skin',
    'heart',
    'chest',
    'breath',
    'breathing',
    'asthma',
    'blood',
    'pressure',
    'sugar',
    'diabetes',
    'cholesterol',
    'stomach',
    'nausea',
    'vomit',
    'diarrhea',
    'constipation',
    'pregnancy',
    'period',
    'mental',
    'stress',
    'anxiety',
    'depression',
    'sleep',
    'diet',
    'nutrition',
    'exercise',
    'workout',
    'bmi',
    'sehat',
    'tabiyat',
    'bimar',
    'bimari',
    'bukhar',
    'khansi',
    'dard',
    'sir dard',
    'pet',
    'saans',
    'sans',
    'dawa',
    'davai',
    'dawaai',
    'ilaaj',
    'ilaj',
    'injection',
    'bp',
    'sugar',
    'pregnant',
    'neend',
  ];

  return healthKeywords.some((keyword) => message.includes(keyword));
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
  const message = userMessage.toLowerCase();

  if (message.includes('fever') || message.includes('temperature')) {
    if (language === 'hindi') {
      return 'Agar aapko bukhar hai, paani pite rahiye aur rest kijiye. Agar temperature 103 F (39.4 C) se upar ho, bukhar 3 din se zyada rahe, ya saans/chest pain jaisi serious symptoms ho, doctor ya emergency care se turant contact kijiye.';
    }

    return 'If you have a fever, make sure to stay hydrated and rest. If your temperature is above 103 F (39.4 C) or persists for more than 3 days, please consult a doctor immediately.';
  }

  if (message.includes('headache') || message.includes('pain')) {
    if (language === 'hindi') {
      return 'Headache ya pain ke kai reasons ho sakte hain. Paani pijiye, rest kijiye, aur agar pain severe hai, baar-baar aa raha hai, ya kisi aur serious symptom ke saath hai to healthcare professional ko dikhaiye.';
    }

    return 'Headaches can have many causes. Try resting in a quiet, dark room and staying hydrated. If the pain is severe or persistent, please see a healthcare professional.';
  }

  if (message.includes('appointment') || message.includes('book')) {
    if (language === 'hindi') {
      return 'Main appointment book karne me help kar sakta hoon. Please preferred date, time, aur doctor specialty choose kijiye.';
    }

    return 'I can help you book an appointment with one of our doctors. Please choose your preferred date, time, and doctor specialty.';
  }

  if (message.includes('medication') || message.includes('medicine')) {
    if (language === 'hindi') {
      return 'Medicine lene se pehle doctor ya pharmacist se consult kijiye. Wo aapki health condition ke hisaab se safe guidance de sakte hain.';
    }

    return 'Please consult your doctor or pharmacist before taking medication. They can provide personalized advice based on your health condition.';
  }

  if (message.includes('exercise') || message.includes('workout')) {
    if (language === 'hindi') {
      return 'Regular exercise health ke liye achhi hoti hai. Hafte me lagbhag 150 minutes moderate activity aim kar sakte hain, lekin nayi routine start karne se pehle doctor se consult kijiye agar koi medical condition hai.';
    }

    return 'Regular exercise is great for health. Aim for at least 150 minutes of moderate aerobic activity per week, and consult your doctor before starting a new routine.';
  }

  if (message.includes('diet') || message.includes('food')) {
    if (language === 'hindi') {
      return 'Balanced diet me fruits, vegetables, whole grains, aur lean proteins include kijiye. Personalized diet ke liye nutritionist ya doctor se consult karna best rahega.';
    }

    return 'A balanced diet with fruits, vegetables, whole grains, and lean proteins supports good health. Consider consulting a nutritionist for personalized advice.';
  }

  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    if (language === 'hindi') {
      return 'Hello! Main aapka health companion hoon. Aaj main aapki health concern me kaise help kar sakta hoon?';
    }

    return 'Hello! I am your health companion. How can I help you with your health concerns today?';
  }

  if (message.includes('thank you') || message.includes('thanks')) {
    if (language === 'hindi') {
      return 'Aapka swagat hai. Main health questions me help kar sakta hoon, lekin medical emergency me turant emergency services se contact kijiye.';
    }

    return 'You are welcome. I am here to help with health questions, but for medical emergencies, please contact emergency services immediately.';
  }

  if (language === 'hindi') {
    return 'Main aapke health questions me help karne ke liye hoon. Medical advice ke liye qualified healthcare professional se consult kijiye. Aap apni health concern ke baare me aur bata sakte hain?';
  }

  return 'I am here to help with your health questions. For medical advice, please consult a qualified healthcare professional. How else can I assist you?';
}

export { router as chatbotRouter };
