import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Sen deneyimli bir AI video script yazarısın. Türk markaları için TikTok, Instagram, YouTube ve UGC formatlarında viral video scriptleri yazıyorsun.

ALTIN KURALLAR:
- İlk 3 saniye: soru sor veya şok et, asla marka logosuyla başlama
- Hook'lar ikinci şahıs kullan: "Bunu hiç yaşadın mı?", "Neden rakiplerin..."
- Her sahne maksimum 3-4 saniye
- Türkçe voiceover: kısa cümleler, noktalama ile nefes ver, konuşma dili
- Görsel promptlarda: mutlaka lighting, camera angle, mood, subject, action belirt
- Görsel promptlar İngilizce, voiceover Türkçe

SAHNELEME:
- 15-30 saniyelik videolar için 4-6 sahne
- 30-60 saniyelik videolar için 6-10 sahne
- Her sahnede görsel prompt + voiceover aynı duyguyu taşımalı

ÇIKTI FORMATI (kesinlikle bu yapıyı kullan, her script için):
SCRIPT_START
title: [Script başlığı]
platform: [Platform adı]
duration: [Süre]
SCENE_1
visual: [İngilizce görsel prompt - detaylı]
voice: [Türkçe voiceover metni]
duration: 3s
SCENE_2
...
HOOK: [İlk 3 saniyenin hook cümlesi]
CTA: [Son 3 saniyenin CTA metni]
FULL_VOICE: [Tüm voiceover tek parça]
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
  const script = { title: '', platform: '', duration: '', scenes: [], hook: '', cta: '', fullVoice: '' };
  let currentScene = null;
  let fullVoiceMode = false;
  let fullVoiceLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (fullVoiceMode) {
      // Collect remaining lines as full voice
      fullVoiceLines.push(line);
      continue;
    }

    if (line.startsWith('title:')) {
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
    } else if (line.startsWith('HOOK:')) {
      if (currentScene) { script.scenes.push(currentScene); currentScene = null; }
      script.hook = line.replace('HOOK:', '').trim();
    } else if (line.startsWith('CTA:')) {
      script.cta = line.replace('CTA:', '').trim();
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

  const { brand, audience, goal, tone, exampleUrl } = req.body || {};

  if (!brand || !audience || !goal || !tone) {
    return res.status(400).json({ error: 'Eksik alan: brand, audience, goal ve tone zorunludur.' });
  }

  const userMessage = `Aşağıdaki marka için 4 farklı AI video scripti yaz:

Marka / Ürün: ${brand}
Hedef Kitle: ${audience}
Video Amacı: ${goal}
Ton: ${tone}${exampleUrl ? `\nÖrnek Video: ${exampleUrl}` : ''}

Lütfen tam olarak 4 script yaz:
1. TikTok/Reels scripti (15-20 saniye, kısa, hook'lu, durdurucu)
2. Instagram Stories scripti (20-30 saniye, duygusal, hikaye odaklı)
3. YouTube/Reklam scripti (45-60 saniye, dönüşüm odaklı)
4. UGC stili script (30-45 saniye, sanki gerçek kullanıcı anlatıyor gibi)

Her script için SCRIPT_START...SCRIPT_END formatını kullan.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
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
