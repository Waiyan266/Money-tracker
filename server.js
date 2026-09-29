import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Support base64 image uploads from camera / gallery
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// User's provided API key
const USER_API_KEY = 'AIzaSyANyWnD-Y0G4ZQc_b1k0BMkKjO7_1vNAz0';

const ai = new GoogleGenAI({
  apiKey: USER_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Endpoint to scan and auto-detect receipt / slip details
app.post('/api/scan-slip', async (req, res) => {
  try {
    const { image, mimeType = 'image/jpeg' } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    // Clean base64 if it includes data URL prefix
    const base64Data = image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    let response = null;
    let lastError = null;

    // Multi-model fallback: if one model has transient high demand (503), automatically try the next
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: base64Data,
              }
            },
            {
              text: `You are an expert expense tracker assistant. Analyze this receipt / invoice / slip image carefully (which may be in Burmese, English, Japanese, or other languages).
Extract:
1. amount: Total money paid as a number. Look for 'Total', 'Grand Total', '合計', 'ကျသင့်ငွေ', or the bottom summary total. If currency symbol (¥, $, Ks, MMK) is present, only return the numeric amount (e.g. 1250, 45.5).
2. store: The merchant, shop, restaurant, or business name (e.g. 'City Mart', '7-Eleven', 'Lawson', 'FamilyMart', 'Seiyu', 'MK Restaurant', 'KBZPay merchant'). If unclear, provide the most likely name or 'အထွေထွေအရောင်းဆိုင်'.
3. category: Choose strictly ONE matching category from these exact options:
   - 'အစားအစာ' (Food, restaurant, grocery, beverages, snacks)
   - 'အိမ်သုံးစရိတ်' (Household supplies, home goods, rent, utilities)
   - 'ခရီးစရိတ်' (Transportation, taxi, bus, train, gas/fuel, airfare)
   - 'ဖုန်းနှင့် အင်တာနက်' (Phone bill, data, internet, SIM)
   - 'ကျန်းမာရေး' (Pharmacy, medicine, hospital, doctor)
   - 'ဝတ်ဆင်ရေး' (Clothing, shoes, accessories)
   - 'အပျော်အပါး' (Entertainment, cinema, cafe, hobbies)
   - 'အကြွေးစာရင်း' (Debt payment, credit card bill)
   - 'အထွေထွေ' (Other / general items)
4. date: Transaction date in ISO format YYYY-MM-DD. If missing or year not visible, use the current year or today's date format.
5. note: A brief note in Burmese (with key items mentioned, e.g. 'ခေါက်ဆွဲ၊ ရေသန့်' or 'နေ့လယ်စာ').`
            }
          ],
          config: {
            systemInstruction: "You are an intelligent receipt OCR scanner. Extract exact values from the purchase slip and return structured JSON.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER, description: "Total amount paid (numeric)" },
                store: { type: Type.STRING, description: "Store or shop name" },
                category: { 
                  type: Type.STRING, 
                  description: "Strictly one of: အစားအစာ, အိမ်သုံးစရိတ်, ခရီးစရိတ်, ဖုန်းနှင့် အင်တာနက်, ကျန်းမာရေး, ဝတ်ဆင်ရေး, အပျော်အပါး, အကြွေးစာရင်း, အထွေထွေ" 
                },
                date: { type: Type.STRING, description: "Purchase date in YYYY-MM-DD format" },
                note: { type: Type.STRING, description: "Brief note or items bought in Burmese" }
              },
              required: ["amount", "store", "category", "date"]
            }
          }
        });
        if (response && response.text) {
          console.log(`Slip processed successfully with model: ${modelName}`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} failed (${err.message}). Trying next candidate...`);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('No response from AI model');
    }

    const text = response.text?.trim() || '{}';
    const parsedData = JSON.parse(text);

    return res.json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('Error scanning slip:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze slip image'
    });
  }
});

// Prevent stale browser/service worker caching of index.html and sw.js
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
