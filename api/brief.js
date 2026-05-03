import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sen uzman bir AI video script yazarısın. Türk markaları için TikTok/Reels formatında viral video scriptleri yazıyorsun.

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
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) return null;
  const jsonStr = text.substring(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonStr);
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

  const userMessage = `Marka adı ve ne sattığı: ${brand}
Markanın websitesi: ${website || 'girilmedi'}
Öne çıkarılacak ürün/hizmet linki: ${productUrl || 'girilmedi'}
Marka renkleri: ${colors || 'belirtilmedi'}
Hedef kitle: ${audience}
Video amacı: ${goal}
Ton: ${tone}
En büyük rakip: ${competitor || 'belirtilmedi'}
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

  let scripts;
  try {
    scripts = parseScripts(rawText);
  } catch (parseErr) {
    console.error('[brief] Parse error:', parseErr.message);
    return res.status(200).json({ raw: rawText, error: 'parse_failed' });
  }

  if (!scripts) {
    return res.status(200).json({ raw: rawText, scripts: [] });
  }

  return res.status(200).json({ scripts });
}
