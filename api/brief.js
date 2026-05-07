const SYSTEM_PROMPT = `ÖNCELİKLE verilen linki web_search ile ziyaret et ve markanın ürününü, hedef kitlesini, marka tonunu, renklerini ve fiyat bilgisini çıkar. Sonra bu bilgileri kullanarak script yaz.

Sen uzman bir AI video script yazarısın. Türk markaları için TikTok/Reels formatında viral video scriptleri yazıyorsun.

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
  let cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  cleaned = cleaned.substring(first, last + 1);

  // Nuclear sanitization: process char by char,
  // replace newlines/tabs inside strings with space
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      result += ' ';
      continue;
    }
    result += ch;
  }

  return [JSON.parse(result)];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { website, productUrl, goal, platform, exampleUrl, discountCode } = req.body || {};
  const siteUrl = website || productUrl || '';

  if (!siteUrl) {
    return res.status(400).json({ error: 'Website veya ürün linki zorunludur.' });
  }

  let messages = [{
    role: 'user',
    content: `Website veya ürün linki: ${siteUrl}
Video amacı: ${goal || 'Satış artırmak'}
Platform: ${platform || 'TikTok/Reels'}
${exampleUrl ? 'Örnek video: ' + exampleUrl : ''}`
  }];

  for (let turn = 0; turn < 5; turn++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    console.log(`[brief] turn=${turn} stop_reason=${data.stop_reason}`);

    if (data.stop_reason === 'end_turn') {
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      console.log('[brief] Raw Claude response:', text.substring(0, 500));

      let scripts;
      try {
        scripts = parseScripts(text);
      } catch (parseErr) {
        console.error('[brief] Parse error:', parseErr.message);
        return res.status(500).json({ error: 'parse_failed', raw: text });
      }

      console.log('[brief] Parsed scripts:', JSON.stringify(scripts));
      if (!scripts) return res.status(500).json({ error: 'parse_failed', raw: text });

      try {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_video_brief_leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            website: siteUrl,
            goal: goal || '',
            platform: platform || '',
            discount_code: discountCode || '',
            script_title: scripts[0]?.title || '',
            script_framework: scripts[0]?.framework || '',
            hook_main: scripts[0]?.hookMain || '',
            full_voice: scripts[0]?.fullVoice || ''
          })
        });
        console.log('[brief] Lead saved to Supabase');
      } catch(e) { console.error('[brief] Supabase:', e.message); }

      return res.status(200).json({ scripts });
    }

    if (data.stop_reason === 'tool_use') {
      messages = [...messages, { role: 'assistant', content: data.content }];
      const toolResults = (data.content || [])
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
      if (toolResults.length > 0) {
        messages = [...messages, { role: 'user', content: toolResults }];
      }
      continue;
    }

    return res.status(200).json({ error: 'unexpected stop', raw: JSON.stringify(data) });
  }

  return res.status(500).json({ error: 'max turns reached' });
}
