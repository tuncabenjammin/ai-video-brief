import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sen dünyaca kanıtlanmış viral video framework'lerini kullanan uzman bir AI video script yazarısın. Türk markaları için TikTok/Reels formatında yüksek performanslı scriptler yazıyorsun.

ÖNEMLİ: Marka hakkında verilen bilgileri AYNEN kullan. Markanın ne olduğunu, ne sattığını, kime sattığını tam olarak anla. Yanlış kategori veya sektörde script yazma.

FRAMEWORK SEÇİMİ (amaca göre otomatik seç):
- Satış artırmak → Hook → Problem → Agitation → Solution → CTA
- Marka bilinirliği → Hook → Story → Offer → CTA
- Sosyal kanıt → Hook → Social Proof → Result → CTA
- Reklam → Hook → Curiosity Gap → Reveal → CTA

ALTIN KURALLAR:
- Hook: İlk 3 saniye. İkinci şahıs. Soru veya şok cümlesi. "Sen" ile başla.
- Her sahne: 3-4 saniye, tek bir güçlü görsel fikir
- Voiceover: Kısa, konuşma dili, noktalama ile nefes ver
- Görsel promptlar: İNGİLİZCE, detaylı (lighting + camera angle + mood + subject + action + brand colors)
- Marka renklerini görsel promptlara dahil et
- Rakip baskısını mutlaka bir sahnede kullan

ÇIKTI FORMATI:
SCRIPT_START
framework: [seçilen framework adı]
title: [çarpıcı başlık]
platform: TikTok/Reels
duration: 20-30sn
HOOK_MAIN: [Ana hook - Türkçe, max 10 kelime]
HOOK_ALT: [Alternatif hook - Türkçe, farklı açıdan, max 10 kelime]
SCENE_1
visual: [İngilizce, detaylı: lighting, camera, mood, subject, action, brand colors - min 20 kelime]
voice: [Türkçe, max 10 kelime, noktalama ile ritim ver]
duration: 3s
SCENE_2
visual: [İngilizce, detaylı - min 20 kelime]
voice: [Türkçe, max 10 kelime]
duration: 3s
SCENE_3
visual: [İngilizce, detaylı - min 20 kelime]
voice: [Türkçe, max 10 kelime]
duration: 3s
SCENE_4
visual: [İngilizce, detaylı - min 20 kelime]
voice: [Türkçe, max 10 kelime]
duration: 3s
CTA_MAIN: [Ana CTA - Türkçe, aksiyona yönlendiren, max 8 kelime]
CTA_ALT: [Alternatif CTA - Türkçe, farklı açı, max 8 kelime]
FULL_VOICE: [Tüm voiceover tek parça - Türkçe, ElevenLabs'e yapıştır]
SCRIPT_END`;

function parseScripts(text) {
  const scripts = [];
  const blocks = text.split('SCRIPT_START').slice(1);

  for (const block of blocks) {
    const end = block.indexOf('SCRIPT_END');
    const content = end !== -1 ? block.substring(0, end) : block;

    const get = (key) => {
      const regex = new RegExp(key + ':\\s*(.+?)(?=\\n[A-Z_]+:|$)', 's');
      const match = content.match(regex);
      return match ? match[1].trim() : '';
    };

    const scenes = [];
    const sceneRegex = /SCENE_(\d+)\s*\nvisual:\s*([\s\S]*?)\nvoice:\s*(.*?)\nduration:\s*(.*?)(?=\nSCENE_|\nCTA_|\nHOOK_|\nFULL_VOICE|$)/g;
    let sceneMatch;
    while ((sceneMatch = sceneRegex.exec(content)) !== null) {
      scenes.push({
        visual: sceneMatch[2].trim(),
        voice: sceneMatch[3].trim(),
        duration: sceneMatch[4].trim()
      });
    }

    scripts.push({
      framework: get('framework'),
      title: get('title'),
      platform: get('platform'),
      duration: get('duration'),
      hookMain: get('HOOK_MAIN'),
      hookAlt: get('HOOK_ALT'),
      scenes,
      ctaMain: get('CTA_MAIN'),
      ctaAlt: get('CTA_ALT'),
      fullVoice: get('FULL_VOICE')
    });
  }

  return scripts.length > 0 ? scripts : null;
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
