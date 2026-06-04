import express from 'express';
import { ApiResponse } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
router.use(authenticateToken);

type PreferredLanguage = 'english' | 'hindi';

type DietPlanRequest = {
  condition?: string;
  allergies?: string;
  excludedFoods?: string;
  calorieTarget?: string;
  bodyGoal?: string;
  activityLevel?: string;
};

type DietPlanResponse = {
  plan: string;
};

const FALLBACK_MODEL = 'llama-3.1-8b-instant';

router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const input = sanitizeDietPlanRequest(req.body);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' } as ApiResponse<null>);
    }

    if (!input.condition) {
      return res.status(400).json({ success: false, error: 'Disease or health condition is required' } as ApiResponse<null>);
    }

    const language = detectPreferredLanguage([input.condition, input.allergies, input.excludedFoods].join(' '));
    const plan = await generateDietPlan(input, language);

    res.status(201).json({
      success: true,
      data: { plan },
      message: 'Diet and wellness plan generated successfully',
    } as ApiResponse<DietPlanResponse>);
  } catch (error) {
    console.error('Diet plan error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate diet plan' } as ApiResponse<null>);
  }
});

function sanitizeDietPlanRequest(body: DietPlanRequest): Required<DietPlanRequest> {
  return {
    condition: clean(body.condition),
    allergies: clean(body.allergies),
    excludedFoods: clean(body.excludedFoods),
    calorieTarget: clean(body.calorieTarget),
    bodyGoal: clean(body.bodyGoal),
    activityLevel: clean(body.activityLevel),
  };
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

async function generateDietPlan(input: Required<DietPlanRequest>, language: PreferredLanguage): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return generateFallbackDietPlan(input, language);
  }

  try {
    return await generateGroqDietPlan(input, language);
  } catch (error) {
    console.warn('Groq diet plan failed, using fallback:', error);
    return generateFallbackDietPlan(input, language);
  }
}

async function generateGroqDietPlan(input: Required<DietPlanRequest>, language: PreferredLanguage): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? FALLBACK_MODEL,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(language),
        },
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
      max_completion_tokens: Number(process.env.GROQ_DIET_MAX_TOKENS ?? process.env.GROQ_MAX_TOKENS ?? 700),
      temperature: Number(process.env.GROQ_TEMPERATURE ?? 0.45),
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq diet plan response not OK: ${response.status}`);
  }

  const result = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return result.choices?.[0]?.message?.content?.trim() || generateFallbackDietPlan(input, language);
}

function getSystemPrompt(language: PreferredLanguage): string {
  const languageInstruction =
    language === 'hindi'
      ? 'Reply in simple Hindi/Hinglish because the patient wrote in Hindi or Hinglish.'
      : 'Reply in clear English because the patient wrote in English.';

  return `${languageInstruction} You are a safe healthcare diet and wellness assistant for MediCare AI. Create practical diet, yoga, and exercise suggestions only for health-related needs. Do not diagnose. Do not prescribe medicines. Respect allergies and excluded foods strictly. If the patient has pregnancy, kidney disease, liver disease, eating disorder symptoms, severe obesity, diabetes complications, chest pain, breathing difficulty, or severe/persistent symptoms, advise consulting a qualified doctor or dietitian. Keep the plan concise, structured, and safe.`;
}

function buildUserPrompt(input: Required<DietPlanRequest>): string {
  return [
    `Disease or health condition: ${input.condition}`,
    `Food allergies: ${input.allergies || 'Not provided'}`,
    `Foods to avoid or not add in diet: ${input.excludedFoods || 'Not provided'}`,
    `Calorie target or calorie need: ${input.calorieTarget || 'Not provided'}`,
    `Body goal: ${input.bodyGoal || 'Not provided'}`,
    `Activity level: ${input.activityLevel || 'Not provided'}`,
    '',
    'Create:',
    '1. Short safety note.',
    '2. Calorie-aware daily diet plan with breakfast, lunch, snacks, dinner, hydration.',
    '3. Foods to avoid based on allergies/exclusions and condition.',
    '4. Yoga asanas or gentle exercises suitable for the condition.',
    '5. When to consult a doctor.',
  ].join('\n');
}

function detectPreferredLanguage(text: string): PreferredLanguage {
  const message = text.toLowerCase();

  if (/[\u0900-\u097f]/.test(message)) {
    return 'hindi';
  }

  const hindiMarkers = [
    'mujhe',
    'mere',
    'meri',
    'mera',
    'bimari',
    'bimaari',
    'bukhar',
    'khansi',
    'dard',
    'mota',
    'motapa',
    'patla',
    'patlepan',
    'khana',
    'sehat',
    'tabiyat',
    'aasan',
  ];

  return hindiMarkers.some((marker) => new RegExp(`\\b${marker}\\b`).test(message)) ? 'hindi' : 'english';
}

function generateFallbackDietPlan(input: Required<DietPlanRequest>, language: PreferredLanguage): string {
  const excluded = [input.allergies, input.excludedFoods].filter(Boolean).join(', ') || (language === 'hindi' ? 'jo foods aap avoid karna chahte hain' : 'foods you need to avoid');

  if (language === 'hindi') {
    return [
      `Condition: ${input.condition}`,
      `Safety: Ye general diet aur wellness guidance hai. Apni exact condition ke liye doctor ya dietitian se confirm karein.`,
      `Diet: Breakfast me oats/poha/daliya with protein source, lunch me dal/lean protein + vegetables + controlled roti/rice, evening snack me fruit ya roasted chana, dinner light rakhein with vegetables and protein.`,
      `Calories/goal: ${input.calorieTarget || input.bodyGoal || 'calorie need'} ke hisaab se portion size adjust karein. Weight loss ke liye fried/sugary foods kam karein; weight gain ke liye healthy calories jaise nuts, paneer/curd, dal, eggs ya lean protein add karein.`,
      `Avoid: ${excluded}. In foods ko plan me add na karein.`,
      `Yoga/exercise: Gentle walk 20-30 minutes, deep breathing, sukhasana breathing, cat-cow stretch, aur condition ke hisaab se light stretching. Pain, dizziness, chest pain, ya breathing issue ho to exercise stop karein.`,
    ].join('\n\n');
  }

  return [
    `Condition: ${input.condition}`,
    `Safety: This is general diet and wellness guidance. Confirm a personal plan with a doctor or dietitian.`,
    `Diet: Breakfast can include oats/porridge with a protein source, lunch can include lentils or lean protein with vegetables and controlled rice/roti portions, evening snack can be fruit or roasted chickpeas, and dinner should be lighter with vegetables and protein.`,
    `Calories/goal: Adjust portions based on ${input.calorieTarget || input.bodyGoal || 'your calorie need'}. For weight loss, reduce fried and sugary foods. For weight gain, add healthy calories such as nuts, curd, paneer, lentils, eggs, or lean protein if suitable.`,
    `Avoid: ${excluded}. Do not add these foods to the diet plan.`,
    `Yoga/exercise: Try gentle walking for 20-30 minutes, deep breathing, seated breathing, cat-cow stretch, and light stretching as tolerated. Stop if pain, dizziness, chest pain, or breathing difficulty occurs.`,
  ].join('\n\n');
}

export { router as dietPlanRouter };
