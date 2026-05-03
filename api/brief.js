import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sen uzman bir AI video script yazarısın. Türk markaları için TikTok/Reels formatında viral video scriptleri yazıyorsun.

KRİTİK: Yanıtın ilk karakteri { olmalı. scenes array'i mutlaka 4 eleman içermeli. Her eleman visual, voice, duration key'lerini içermeli.

ÖNEMLİ: YALNIZCA geçerli JSON döndür. Başka hiçbir şey yazma. { ile başla } ile bit.

FRAMEWORK SEÇİMİ:
- Satış artırmak → Hook → Problem → Agitation → Solution → CTA
- Marka bilinirliği → Hook → Story → Offer → CTA
- Sosyal kanıt → Hook → Social Proof → Result → CTA
- Reklam → Hook → Curiosity Gap → Reveal → CTA

KURALLAR:
- Hook: ikinci şahıs, soru veya şok, "Sen" ile başla
- Görsel promptlar: İNGİLİZCE, detaylı (lighting + camera angle + mood + subject + action + brand colors), min 20 kelime
- Voiceover: Türkçe, konuşma dili, kısa cümleler
- Marka renklerini görsel promptlara dahil et
- Rakip baskısını bir sahnede kullan

JSON FORMATI:
{
  "framework": "seçilen framework",
  "title": "çarpıcı başlık",
  "platform": "TikTok/Reels",
  "duration": "20-30sn",
  "hookMain": "Ana hook Türkçe max 10 kelime",
  "hookAlt": "Alternatif hook Türkçe farklı açıdan max 10 kelime",
  "scenes": [
    {
      "visual": "English detailed prompt min 20 words with lighting camera mood subject action brand colors",
      "voice": "Türkçe voiceover max 10 kelime",
      "duration": "3s"
    },
    {
      "visual": "...",
      "voice": "...",
      "duration": "3s"
    },
    {
      "visual": "...",
      "voice": "...",
      "duration": "3s"
    },
    {
      "visual": "...",
      "voice": "...",
      "duration": "3s"
    }
  ],
  "ctaMain": "Ana CTA Türkçe max 8 kelime",
  "ctaAlt": "Alternatif CTA Türkçe farklı açı max 8 kelime",
  "fullVoice": "Tüm voiceover tek parça Türkçe ElevenLabs için"
}`;

function parseScripts(text) {
  // Remove markdown fences
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Find JSON boundaries
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1) return null;

  cleaned = cleaned.substring(first, last + 1);

  // Fix common JSON issues: replace actual newlines inside string values with \n
  // This regex replaces literal newlines between quotes with escaped version
  cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  });

  const parsed = JSON.parse(cleaned);
  return [parsed];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { brand, website, productUrl, audience, goal, tone, exampleUrl, colors, competitor } = req.body || {};

  if (!brand || !audience || !goal || !tone) {
    return res.status(400).json({ error: 'Eksik alan: brand, audience, goal ve tone zorunludur.' });
  }

  const urlInfo = [];
  if (website && website.trim()) urlInfo.push(`Markanın websitesi: ${website}`);
  if (productUrl && productUrl.trim()) urlInfo.push(`Öne çıkarılacak ürün/hizmet linki: ${productUrl}`);

  const userMessage = `Marka adı ve ne satar: ${brand}
Markanın websitesi veya ürün linki: ${urlInfo.join(' | ') || 'girilmedi'}
Marka renkleri: ${colors}
Hedef kitle: ${audience}
En büyük rakip: ${competitor}
Video amacı: ${goal}
Ton: ${tone}
Örnek video: ${exampleUrl || 'belirtilmedi'}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    });
  } catch (err) {
    const status = err.status || 500;
    const errText = err.message || 'API hatası oluştu.';
    console.error('[brief] Anthropic error:', status, errText);
    return res.status(status).json({ error: errText });
  }

  const rawText = message.content[0]?.text || '';
  console.log('[brief] Raw Claude response:', rawText.substring(0, 500));

  let scripts;
  try {
    scripts = parseScripts(rawText);
  } catch (parseErr) {
    console.error('[brief] Parse error:', parseErr.message);
    return res.status(200).json({ raw: rawText, error: 'parse_failed' });
  }

  console.log('[brief] Parsed scripts:', JSON.stringify(scripts));

  if (!scripts) {
    return res.status(200).json({ raw: rawText, scripts: [] });
  }

  scripts = JSON.parse(JSON.stringify(scripts));

  return res.status(200).json({ scripts });
}
