const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.analyzeSymptoms = async (req, res) => {

  try {

    const { symptoms } = req.body;

    const completion =
      await openai.chat.completions.create({

        model: 'gpt-3.5-turbo',

        messages: [

          {
            role: 'system',

            content:
              `
              You are a professional healthcare AI assistant.

              Analyze patient symptoms and provide:

              1. Possible condition
              2. Severity
              3. Recommended specialist
              4. General advice

              Keep response short and professional.
              `
          },

          {
            role: 'user',

            content: symptoms
          }

        ]

      });

    res.json({

      success: true,

      response:
        completion.choices[0].message.content

    });

  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: 'AI Analysis Failed'

    });
  }
};