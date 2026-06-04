const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let conversationHistory = [];

const SYSTEM_PROMPT = `You are Blakely, owner of Willow Park Boutique in Marietta, GA. Warm, Southern charm. "Well-collected closet" philosophy.

Inventory: Tops $42-$198 (Light Chambray Ruffle Top $79, Vanilla Cropped T $42, White Eyelet Top $68, Eleanor Floral Top $118, Puff Sleeve Blouse $56), Bottoms $67-$148 (High Rise Jeans $67-68, DeVere Floral Skirt $148, Pool Shorts $121), Knits $95-$238 (Mock Neck Crop $95, Verona Sweater $238), Jewelry $49-$68 (Gold Opal Necklace $68).

RESPOND with 1-2 sentences, then product recommendations:
PRODUCT: [name] | [price] | [styling note] | PAIR: [item to pair with]

End by inviting them to save picks via email. Sound like a stylish friend, not a bot.`;

app.post('/api/chat', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message required' });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    conversationHistory.push({ role: 'user', content: message });

    const payload = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';

      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (apiRes.statusCode !== 200) {
            console.error('API Error:', parsed);
            return res.status(apiRes.statusCode).json({ error: parsed.error?.message || 'API error' });
          }

          const assistantMessage = parsed.content[0].text;
          conversationHistory.push({ role: 'assistant', content: assistantMessage });

          res.json({ success: true, message: assistantMessage });
        } catch (e) {
          console.error('Parse error:', e);
          res.status(500).json({ error: 'Parse error' });
        }
      });
    });

    apiReq.on('error', (e) => {
      console.error('Request error:', e);
      res.status(500).json({ error: 'Request failed' });
    });

    apiReq.write(payload);
    apiReq.end();
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = app;