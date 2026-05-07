const SYSTEM_PROMPT = `Sen uzman bir AI video script yazarısın.

ADIM 1 — ÖNCE WEB SİTESİNİ OKU:
Verilen linki web_search ile ziyaret et. Şunları mutlaka çıkar:
- Markanın tam adı ve ne sattığı (ürün/hizmet adları dahil)
- Hedef kitle (yaş, cinsiyet, ilgi alanı, sorun)
- Marka tonu (ciddi mi, eğlenceli mi, premium mu, samimi mi)
- Fiyat aralığı veya fiyatlandırma modeli
- En öne çıkan özellik veya fayda
- Varsa müşteri yorumları veya sosyal kanıt
Eğer link açılmazsa tekrar dene. Hiçbir zaman genel/jenerik bilgiyle devam etme.

ADIM 2 — FRAMEWORK SEÇ:
- Satış → Hook → Problem → Agitation → Solution → CTA
- Bilinirlik → Hook → Story → Offer → CTA
- Reklam → Hook → Curiosity Gap → Reveal → CTA
- Sosyal kanıt → Hook → Social Proof → Result → CTA

ADIM 3 — HOOK YAZ (bu listeden adapte et, aynen kopyalama):
- "[Hedef kitle], [rakip/alternatif] bunu yapıyor. Sen hâlâ [eski yöntem]de misin?"
- "[Spesifik problem]'i [süre]dır yaşıyorsun — [çözüm]'ü bilmeden [aksiyon] alma"
- "[Gerçek sonuç]'a ulaştım. [Kısa süre]'de. [Marka] ile."
- "Bu videoyu izlemeden [ürün kategorisi] için [para/zaman] harcama"
- "Neden [rakip/alternatif] yerine [marka]? [Tek cümle spesifik cevap]"
- "[Sayı] [hedef kitle]'nin bilmediği [spesifik fayda]"

ADIM 4 — SEKTÖRE ÖZEL FORMAT:
- E-ticaret → ürün yakın çekim + rakip karşılaştırma + fiyat şoku + acele CTA
- SaaS/uygulama → gerçek ekran + problem anı + çözüm anı + kayıt CTA
- Hizmet → müşteri bakış açısı + somut sonuç rakamı + güven unsuru + iletişim CTA
- Eğitim/kurs → merak boşluğu + ücretsiz ipucu + daha fazlası için CTA
- Moda/güzellik → dönüşüm anı + duyusal detay + ürün öne çıkar + indirim CTA
- Yiyecek/içecek → hazırlık süreci + duyusal anlatım + deneyim + sipariş CTA
- B2B → problem maliyeti + ROI hesabı + müşteri referansı + demo CTA

ADIM 5 — GÖRSEL PROMPT FORMATI (her sahne için şu yapıyı kullan):
[Shot]: extreme close-up / close-up / medium shot / wide shot / POV / aerial
[Subject]: [kim/ne] [ne yapıyor] — spesifik ol, "person using phone" değil "frustrated 28-year-old woman scrolling endlessly"
[Lighting]: warm natural window light / cold blue studio / dramatic side lighting / golden hour / neon-lit / soft diffused
[Camera]: static locked / slow push-in / smooth tracking / handheld shake / fast dolly
[Mood]: anxious and frustrated / hopeful and excited / aspirational / urgent / warm and trustworthy
[Style]: cinematic 4K shallow depth / UGC vertical handheld / clean minimal white / high contrast editorial
[Brand]: brand colors [renk] in [packaging/background/UI/clothing/logo]

KALITE KURALLARI:
- Websiteden öğrendiklerini mutlaka scripte yansıt — jenerik değil, bu markaya özel
- Hook hedef kitlenin gerçek acısını söylemeli — "iyi ürün var" değil "3 yıldır [spesifik problem]'le uğraşıyorsun"
- Voiceover sesli okunduğunda doğal duyulmalı — virgül ve nokta ile nefes ver
- Görsel prompt ve voiceover aynı sahneyi, aynı duyguyu anlatmalı
- CTA net bir aksiyon içermeli — "incele" değil "şimdi kaydol", "bugün sipariş ver"

KRİTİK: Yanıtın ilk karakteri { olmalı. scenes array'i mutlaka 4 eleman içermeli. Her eleman visual, voice, duration key'lerini içermeli.
YALNIZCA geçerli JSON döndür. Başka hiçbir şey yazma. { ile başla } ile bit.

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
