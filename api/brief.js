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
  const blocks = [];
  const regex = /SCRIPT_START([\s\S]*?)SCRIPT_END/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const block = match[1].trim();
    const script = parseBlock(block);
    if (script) blocks.push(script);
  }

  return blocks;
}

function parseBlock(block) {
  const lines = block.split('\n');
  const script = {
    framework: '', title: '', platform: '', duration: '',
    hookMain: '', hookAlt: '', scenes: [],
    ctaMain: '', ctaAlt: '', fullVoice: ''
  };
  let currentScene = null;
  let fullVoiceMode = false;
  let fullVoiceLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (fullVoiceMode) {
      fullVoiceLines.push(line);
      continue;
    }

    if (line.startsWith('framework:')) {
      script.framework = line.replace('framework:', '').trim();
    } else if (line.startsWith('title:')) {
      script.title = line.replace('title:', '').trim();
    } else if (line.startsWith('platform:')) {
      script.platform = line.replace('platform:', '').trim();
    } else if (line.startsWith('duration:') && !currentScene) {
      script.duration = line.replace('duration:', '').trim();
    } else if (/^SCENE_\d+/.test(line)) {
      if (currentScene) script.scenes.push(currentScene);
      currentScene = { visual: '', voice: '', duration: '' };
    } else if (currentScene) {
      if (line.startsWith('visual:')) {
        currentScene.visual = line.replace('visual:', '').trim();
      } else if (line.startsWith('voice:')) {
        currentScene.voice = line.replace('voice:', '').trim();
      } else if (line.startsWith('duration:')) {
        currentScene.duration = line.replace('duration:', '').trim();
      }
    } else if (line.startsWith('HOOK_MAIN:')) {
      if (currentScene) { script.scenes.push(currentScene); currentScene = null; }
      script.hookMain = line.replace('HOOK_MAIN:', '').trim();
    } else if (line.startsWith('HOOK_ALT:')) {
      script.hookAlt = line.replace('HOOK_ALT:', '').trim();
    } else if (line.startsWith('HOOK:')) {
      if (currentScene) { script.scenes.push(currentScene); currentScene = null; }
      if (!script.hookMain) script.hookMain = line.replace('HOOK:', '').trim();
    } else if (line.startsWith('CTA_MAIN:')) {
      script.ctaMain = line.replace('CTA_MAIN:', '').trim();
    } else if (line.startsWith('CTA_ALT:')) {
      script.ctaAlt = line.replace('CTA_ALT:', '').trim();
    } else if (line.startsWith('CTA:')) {
      if (!script.ctaMain) script.ctaMain = line.replace('CTA:', '').trim();
    } else if (line.startsWith('FULL_VOICE:')) {
      const inline = line.replace('FULL_VOICE:', '').trim();
      if (inline) fullVoiceLines.push(inline);
      fullVoiceMode = true;
    }
  }

  if (currentScene) script.scenes.push(currentScene);
  if (fullVoiceLines.length) script.fullVoice = fullVoiceLines.join('\n').trim();

  return script;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { brand, audience, goal, tone, exampleUrl, colors, competitor } = req.body || {};

  if (!brand || !audience || !goal || !tone) {
    return res.status(400).json({ error: 'Eksik alan: brand, audience, goal ve tone zorunludur.' });
  }

  const userMessage = `Marka adı ve ne sattığı: ${brand}
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

  if (scripts.length === 0) {
    return res.status(200).json({ raw: rawText, scripts: [] });
  }

  return res.status(200).json({ scripts });
}
