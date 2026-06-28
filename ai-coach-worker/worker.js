// AI Coach Worker — Chat, STT, TTS, Knowledge, Interviews, Content Generation
// Powered by Workers AI (Gemma 4 26B, Whisper, MeloTTS, BGE Embeddings)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── Interview Questions (phased, adaptive) ──
const INTERVIEW_PHASES = [
  { phase: 'background', label: 'Your Background', prompt: 'Ask about their name, where they\'re from, what they do, and what got them interested in singing.' },
  { phase: 'voice', label: 'Your Voice', prompt: 'Ask about their voice type (tenor, soprano, etc), range, what feels comfortable vs challenging, and if they\'ve had any training.' },
  { phase: 'style', label: 'Your Style', prompt: 'Ask about their favorite genres, artists they love to sing, songs they wish they could pull off, and what kind of karaoke nights they enjoy.' },
  { phase: 'goals', label: 'Your Goals', prompt: 'Ask what they want to achieve — performing live, recording, improving technique, building confidence, or just having fun.' },
  { phase: 'brand', label: 'Your Brand', prompt: 'Ask about their stage persona, what makes them unique, how they want to be perceived, and what content they\'d like to create (social media, videos, etc).' },
  { phase: 'content', label: 'Content & Promotion', prompt: 'Ask about their advertising goals, what they want to promote, their social media presence, and what kind of content they\'re interested in creating.' },
];

// ── SYSTEM PROMPT ──
function buildSystemPrompt(knowledge) {
  let context = '';
  if (knowledge && knowledge.length > 0) {
    context = '\n\nHere is what I know about you from previous conversations:\n' +
      knowledge.map(k => `- ${k.key}: ${k.value}`).join('\n');
  }

  return `You are an AI Coach — a friendly, expert singing coach and creative assistant for the Orion SupaSing ecosystem.

Your roles:
1. **Singing Coach**: Help improve vocal technique, suggest warm-ups, recommend songs based on voice type, give practice feedback.
2. **Creative Partner**: Brainstorm ideas for ads, social media content, promotions, and branding.
3. **Personal Assistant**: Research topics, answer questions, help plan content strategy.
4. **Interviewer**: When in interview mode, ask structured questions to learn about the user's background, voice, goals, and brand.

Be conversational, encouraging, and specific. Ask follow-up questions. Don't be generic — give actionable advice.

Current user knowledge:${context || ' (none yet — get to know them!)'}

Keep responses concise but helpful. Use markdown sparingly.`; }

// ── MAIN WORKER ──
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    // ── HEALTH ──
    if (path === '/health') {
      return json({ status: 'ok', service: 'ai-coach', timestamp: new Date().toISOString() });
    }

    // ── CHAT ──
    if (path === '/chat' && method === 'POST') {
      try {
        const { message, conversation_id } = await request.json();
        if (!message) return json({ error: 'message required' }, 400);

        // Fetch or create conversation
        let convId = conversation_id;
        if (!convId) {
          const result = await env.DB.prepare('INSERT INTO conversations (title) VALUES (?)').bind(message.slice(0, 60)).run();
          convId = result.meta.last_row_id;
        }

        // Save user message
        await env.DB.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').bind(convId, 'user', message).run();

        // Fetch recent conversation history
        const { results: history } = await env.DB.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 30').bind(convId).all();

        // Fetch relevant knowledge from Vectorize
        let knowledge = [];
        try {
          const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [message] });
          if (embedding?.data?.[0]) {
            const query = await env.VECTORIZE.query(embedding.data[0], { topK: 5, returnMetadata: true });
            if (query?.matches) {
              for (const match of query.matches) {
                if (match.metadata) {
                  knowledge.push({ key: match.metadata.key, value: match.metadata.value });
                }
              }
            }
          }
        } catch (e) {
          // Vectorize not available — continue without
        }

        // Build messages array for AI
        const systemMessage = { role: 'system', content: buildSystemPrompt(knowledge) };
        const chatHistory = history.map(m => ({ role: m.role, content: m.content }));
        const messages = [systemMessage, ...chatHistory];

        // Call Workers AI (Gemma 4 26B)
        let reply = 'Sorry, I couldn\'t generate a response right now.';
        try {
          const aiResp = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
            messages,
            max_tokens: 4096,
            temperature: 0.7,
          });
          if (aiResp?.response) reply = aiResp.response.trim();
          else if (aiResp?.result?.response) reply = aiResp.result.response.trim();
          else if (aiResp?.choices?.[0]?.message?.content) reply = aiResp.choices[0].message.content.trim();
          else if (typeof aiResp === 'string' && aiResp) reply = aiResp.trim();
        } catch (e) {
          reply = `I encountered an error: ${e.message}`;
        }

        // Save assistant message
        await env.DB.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').bind(convId, 'assistant', reply).run();

        // Update conversation timestamp
        await env.DB.prepare('UPDATE conversations SET updated_at = datetime(\'now\') WHERE id = ?').bind(convId).run();

        return json({ reply, conversation_id: convId });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ── CONVERSATIONS ──
    if (path === '/conversations') {
      if (method === 'POST') {
        try {
          const { title } = await request.json();
          const result = await env.DB.prepare('INSERT INTO conversations (title) VALUES (?)').bind(title || 'New chat').run();
          return json({ conversation_id: result.meta.last_row_id }, 201);
        } catch (e) { return json({ error: e.message }, 500); }
      }

      try {
        const { results } = await env.DB.prepare('SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50').all();
        return json({ conversations: results });
      } catch (e) { return json({ conversations: [] }); }
    }

    // ── MESSAGES ──
    if (path === '/messages' && method === 'GET') {
      const convId = url.searchParams.get('conversation_id');
      if (!convId) return json({ error: 'conversation_id required' }, 400);
      try {
        const { results } = await env.DB.prepare('SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC').bind(convId).all();
        return json({ messages: results });
      } catch (e) { return json({ messages: [] }); }
    }

    // ── KNOWLEDGE ──
    if (path === '/knowledge') {
      if (method === 'POST') {
        try {
          const { key, value, category } = await request.json();
          if (!key || !value) return json({ error: 'key and value required' }, 400);

          await env.DB.prepare('INSERT INTO knowledge_entries (key, value, category) VALUES (?, ?, ?)').bind(key, value, category || 'general').run();

          // Generate embedding and store in Vectorize
          try {
            const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [`${key}: ${value}`] });
            if (embedding?.data?.[0]) {
              const id = crypto.randomUUID();
              await env.DB.prepare('UPDATE knowledge_entries SET embedding_id = ? WHERE rowid = (SELECT MAX(rowid) FROM knowledge_entries)').bind(id).run();
              await env.VECTORIZE.upsert([{
                id,
                values: embedding.data[0],
                metadata: { key, value, category: category || 'general' },
              }]);
            }
          } catch (e) {
            // Vectorize insert failed — continue
          }

          return json({ success: true }, 201);
        } catch (e) { return json({ error: e.message }, 500); }
      }

      try {
        const { results } = await env.DB.prepare('SELECT id, key, value, category, created_at FROM knowledge_entries ORDER BY created_at DESC').all();
        return json({ entries: results });
      } catch (e) { return json({ entries: [] }); }
    }

    // ── INTERVIEW ──
    if (path === '/interview' && method === 'POST') {
      try {
        const { answer, session_id } = await request.json();

        // Start new interview
        if (!session_id) {
          const result = await env.DB.prepare('INSERT INTO interview_sessions (context) VALUES (?)').bind(JSON.stringify({ phase: 0, step: 0 })).run();
          const sid = result.meta.last_row_id;

          const firstPhase = INTERVIEW_PHASES[0];
          const aiResp = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
            messages: [
              { role: 'system', content: `You are conducting a friendly interview to learn about a singer. The current phase is "${firstPhase.label}". ${firstPhase.prompt}\n\nAsk ONE open-ended question at a time. Be conversational and warm.` },
              { role: 'user', content: 'Start the interview.' },
            ],
            max_tokens: 300,
            temperature: 0.7,
          });
          const question = aiResp.response?.trim() || `Let's start with phase one: ${firstPhase.label}. Tell me about yourself!`;

          return json({ session_id: sid, question, phase: firstPhase.label });
        }

        // Continue interview
        const session = await env.DB.prepare('SELECT * FROM interview_sessions WHERE id = ?').bind(session_id).first();
        if (!session) return json({ error: 'Session not found' }, 404);

        const ctx = JSON.parse(session.context || '{}');
        const currentPhase = ctx.phase || 0;

        // Save answer
        const phaseQuestion = INTERVIEW_PHASES[currentPhase]?.label || 'General';
        await env.DB.prepare('INSERT INTO interview_answers (session_id, question, answer) VALUES (?, ?, ?)').bind(session_id, phaseQuestion, answer).run();

        // Save as knowledge entry
        try {
          await env.DB.prepare('INSERT INTO knowledge_entries (key, value, category) VALUES (?, ?, ?)').bind(`interview_${phaseQuestion.toLowerCase().replace(/\s+/g, '_')}`, answer, phaseQuestion.toLowerCase()).run();
          const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [`${phaseQuestion}: ${answer}`] });
          if (embedding?.data?.[0]) {
            const id = crypto.randomUUID();
            await env.VECTORIZE.upsert([{ id, values: embedding.data[0], metadata: { key: phaseQuestion, value: answer, category: 'interview' } }]);
          }
        } catch (e) {
          // Non-critical
        }

        // Move to next question or phase
        const nextStep = (ctx.step || 0) + 1;

        if (nextStep >= 3) {
          // Move to next phase or complete
          const nextPhase = currentPhase + 1;
          if (nextPhase >= INTERVIEW_PHASES.length) {
            await env.DB.prepare('UPDATE interview_sessions SET completed = 1, context = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify({ ...ctx, completed: true }), session_id).run();
            return json({ done: true, message: 'Amazing — that\'s all my questions for now! I\'ve learned a lot about you. Check the Knowledge Base to see what I\'ve captured, or just keep chatting whenever.' });
          }

          const phase = INTERVIEW_PHASES[nextPhase];
          const aiResp = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
            messages: [
              { role: 'system', content: `You are conducting a friendly interview to learn about a singer. The current phase is "${phase.label}". ${phase.prompt}\n\nTransition smoothly from the previous topic. Ask ONE open-ended question.` },
              { role: 'user', content: `The user just answered about ${INTERVIEW_PHASES[currentPhase].label}. Move to ${phase.label}.` },
            ],
            max_tokens: 300,
            temperature: 0.7,
          });
          const question = aiResp.response?.trim() || `Great! Now let's talk about ${phase.label}. ${phase.prompt}`;

          await env.DB.prepare('UPDATE interview_sessions SET context = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify({ phase: nextPhase, step: 0 }), session_id).run();

          return json({ session_id, question, phase: phase.label });
        }

        await env.DB.prepare('UPDATE interview_sessions SET context = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(JSON.stringify({ ...ctx, step: nextStep }), session_id).run();

        // Generate next question in same phase
        const phase = INTERVIEW_PHASES[currentPhase];
        const aiResp = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
          messages: [
            { role: 'system', content: `You are conducting a friendly interview. Current phase: "${phase.label}". ${phase.prompt}\n\nAsk ONE follow-up question based on what the user just said. Be specific and conversational.` },
            { role: 'user', content: answer },
          ],
          max_tokens: 300,
          temperature: 0.7,
        });
        const question = aiResp.response?.trim() || `Interesting! Tell me more about that.`;

        return json({ session_id, question, phase: phase.label });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // ── STT (Speech to Text) ──
    if (path === '/stt' && method === 'POST') {
      try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        if (!audioFile) return json({ error: 'audio file required' }, 400);

        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBytes = new Uint8Array(arrayBuffer);

        // Store in R2
        const r2Key = `recordings/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.webm`;
        await env.RECORDINGS.put(r2Key, audioBytes, {
          httpMetadata: { contentType: audioFile.type || 'audio/webm' },
        });

        // Transcribe with Whisper
        let transcript = '';
        try {
          const whisperResp = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
            audio: [...audioBytes],
          });
          transcript = whisperResp?.text?.trim() || '';
        } catch (e) {
          transcript = '';
        }

        // Save recording metadata to D1
        await env.DB.prepare('INSERT INTO recordings (r2_key, transcript, size) VALUES (?, ?, ?)').bind(r2Key, transcript, audioBytes.length).run();

        return json({ text: transcript, r2_key: r2Key, size: audioBytes.length });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // ── TTS (Text to Speech) ──
    if (path === '/tts' && method === 'POST') {
      try {
        const { text } = await request.json();
        if (!text) return json({ error: 'text required' }, 400);

        const MAX_TTS_CHARS = 500;
        const chunks = [];
        for (let i = 0; i < text.length; i += MAX_TTS_CHARS) {
          chunks.push(text.slice(i, i + MAX_TTS_CHARS));
        }

        const audioChunks = [];
        for (const chunk of chunks) {
          const ttsResp = await env.AI.run('@cf/myshell-ai/melotts', { text: chunk });
          if (ttsResp?.audio) {
            audioChunks.push(ttsResp.audio);
          }
        }

        const audioBase64 = audioChunks.join('');

        return json({ audio: audioBase64, format: 'mp3', text_length: text.length });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // ── CONTENT GENERATOR ──
    if (path === '/content' && method === 'POST') {
      try {
        const { prompt, type } = await request.json();
        if (!prompt) return json({ error: 'prompt required' }, 400);

        const aiResp = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
          messages: [
            { role: 'system', content: `You are a creative copywriter and content strategist for the Orion SupaSing karaoke ecosystem. Generate ${type || 'social'} content based on the user's request. Be specific, actionable, and on-brand. Output the content directly without preamble.` },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2048,
          temperature: 0.8,
        });
        const content = aiResp.response?.trim() || 'Could not generate content.';

        await env.DB.prepare('INSERT INTO content_ideas (type, prompt, content) VALUES (?, ?, ?)').bind(type || 'social', prompt, content).run();

        return json({ content, type: type || 'social' });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // ── RECORDINGS ──
    if (path.startsWith('/recordings')) {
      // Specific recording audio file
      const matchId = path.match(/^\/recordings\/(\d+)$/);
      if (matchId) {
        const id = matchId[1];
        try {
          const rec = await env.DB.prepare('SELECT * FROM recordings WHERE id = ?').bind(id).first();
          if (!rec) return json({ error: 'Not found' }, 404);

          const obj = await env.RECORDINGS.get(rec.r2_key);
          if (!obj) return json({ error: 'Audio file not found' }, 404);

          const headers = { 'Content-Type': obj.httpMetadata?.contentType || 'audio/webm', 'Content-Disposition': `inline; filename="recording-${id}.webm"` };
          return new Response(obj.body, { headers });
        } catch (e) { return json({ error: e.message }, 500); }
      }

      // List recordings
      if (path === '/recordings') {
        try {
          const { results } = await env.DB.prepare('SELECT id, r2_key, transcript, duration_ms, size, created_at FROM recordings ORDER BY created_at DESC LIMIT 20').all();
          return json({ recordings: results });
        } catch (e) { return json({ recordings: [] }); }
      }

      return json({ error: 'Not found' }, 404);
    }

    // ── PRACTICE ANALYSIS ──
    if (path === '/practice/analyze' && method === 'POST') {
      try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        const songTitle = formData.get('title') || '';
        const songArtist = formData.get('artist') || '';

        if (!audioFile) return json({ error: 'audio required' }, 400);

        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBytes = new Uint8Array(arrayBuffer);

        // Store recording in R2
        const r2Key = `practice/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.webm`;
        await env.RECORDINGS.put(r2Key, audioBytes, {
          httpMetadata: { contentType: audioFile.type || 'audio/webm' },
        });

        // Transcribe with Whisper
        let transcript = '';
        try {
          const whisperResp = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
            audio: [...audioBytes],
          });
          transcript = whisperResp?.text?.trim() || '';
        } catch (e) { transcript = ''; }

        // Save to D1
        await env.DB.prepare('INSERT INTO recordings (r2_key, transcript, size) VALUES (?, ?, ?)').bind(r2Key, transcript, audioBytes.length).run();

        // Get AI feedback
        let feedback = '';
        try {
          const aiResp = await env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
            messages: [
              { role: 'system', content: 'You are a vocal coach analyzing a karaoke practice recording. Give constructive feedback on: pitch, timing, confidence, breath control, and areas to improve. Be specific and encouraging. Output 3-5 short bullet points.' },
              { role: 'user', content: `Song: "${songTitle}" by ${songArtist}\nTranscribed vocals: "${transcript}"\n\nAnalyze this performance and give feedback.` },
            ],
            max_tokens: 1024,
            temperature: 0.7,
          });
          if (aiResp?.response) feedback = aiResp.response.trim();
          else if (aiResp?.choices?.[0]?.message?.content) feedback = aiResp.choices[0].message.content.trim();
        } catch (e) { feedback = 'Analysis unavailable.'; }

        return json({ transcript, feedback, r2_key: r2Key, size: audioBytes.length });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // ── PROFILE ──
    if (path === '/profile') {
      if (method === 'POST') {
        try {
          const data = await request.json();
          for (const [key, value] of Object.entries(data)) {
            await env.DB.prepare('INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime(\'now\')').bind(key, value, value).run();
          }
          return json({ success: true });
        } catch (e) { return json({ error: e.message }, 500); }
      }

      try {
        const { results } = await env.DB.prepare('SELECT key, value, category, updated_at FROM profile ORDER BY category, key').all();
        const profile = {};
        for (const row of results) profile[row.key] = row.value;
        return json({ profile, entries: results });
      } catch (e) { return json({ profile: {} }); }
    }

    // ── SONG SEARCH (supatraxx D1) ──
    if (path === '/songs/search' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100);
      if (!q) return json({ results: [] });

      try {
        // ── THE "SPILLED BEER" RECOVERY ──
        // 1. Clean the user input (the "forgiving" part)
        // Remove special chars and reduce whitespace to make it fuzzy-friendly
        const cleaned = q.replace(/[^\w\s]/gi, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
        
        if (cleaned.length === 0) return json({ results: [] });

        // 2. Use a standard, high-performance LIKE query
        // We search BOTH Artist and Title to ensure we catch everything
        const searchTerm = `%${cleaned}%`;
        
        const { results: r } = await env.SONG_DB.prepare(
          `SELECT s.songid as id, s.Artist as artist, s.Title as title 
           FROM dbSongs s 
           WHERE s.Artist LIKE ? OR s.Title LIKE ? 
           ORDER BY s.songid LIMIT ?`
        ).bind(searchTerm, searchTerm, limit).all();

        // 3. Ensure we return a clean, predictable array
        // If the DB has nulls or weirdness, we map it to strings here
        const formattedResults = r.map(row => ({
          id: String(row.id),
          artist: row.artist || 'Unknown Artist',
          title: row.title || 'Unknown Title'
        }));

        return json({ query: q, count: formattedResults.length, results: formattedResults });
      } catch (e) { 
        return json({ error: e.message, results: [] }, 500); 
      }
    }

    // ── MY SONGS (personal songbook) ──
    // GET /my-songs — list saved songs
    if (path === '/my-songs' && method === 'GET') {
      try {
        const { results } = await env.DB.prepare('SELECT id, song_id, artist, title, youtube_id, r2_key, created_at FROM my_songs ORDER BY artist ASC').all();
        return json({ songs: results });
      } catch (e) { return json({ songs: [] }); }
    }

    // POST /my-songs — save a song
    if (path === '/my-songs' && method === 'POST') {
      try {
        const { song_id, artist, title, youtube_id } = await request.json();
        if (!song_id || !artist || !title) return json({ error: 'song_id, artist, title required' }, 400);

        const existing = await env.DB.prepare('SELECT id FROM my_songs WHERE song_id = ?').bind(song_id).first();
        if (existing) return json({ error: 'Song already saved', id: existing.id }, 409);

        const result = await env.DB.prepare('INSERT INTO my_songs (song_id, artist, title, youtube_id) VALUES (?, ?, ?, ?)').bind(song_id, artist, title, youtube_id || null).run();
        return json({ success: true, id: result.meta.last_row_id }, 201);
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // DELETE /my-songs/:id — remove a song
    if (path.match(/^\/my-songs\/(\d+)$/) && method === 'DELETE') {
      const id = path.match(/^\/my-songs\/(\d+)$/)[1];
      try {
        const song = await env.DB.prepare('SELECT r2_key FROM my_songs WHERE id = ?').bind(id).first();
        if (song?.r2_key) {
          try { await env.RECORDINGS.delete(song.r2_key); } catch {}
        }
        await env.DB.prepare('DELETE FROM my_songs WHERE id = ?').bind(id).run();
        return json({ success: true });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // POST /my-songs/upload — upload MP3 for a saved song
    if (path === '/my-songs/upload' && method === 'POST') {
      try {
        const formData = await request.formData();
        const songId = formData.get('song_id');
        const audioFile = formData.get('audio');

        if (!songId || !audioFile) return json({ error: 'song_id and audio required' }, 400);

        const song = await env.DB.prepare('SELECT * FROM my_songs WHERE id = ?').bind(songId).first();
        if (!song) return json({ error: 'Song not found' }, 404);

        const arrayBuffer = await audioFile.arrayBuffer();
        const r2Key = `my-songs/${songId}_${song.artist.replace(/[^a-z0-9]/gi, '_')}_${song.title.replace(/[^a-z0-9]/gi, '_')}.webm`;

        await env.RECORDINGS.put(r2Key, new Uint8Array(arrayBuffer), {
          httpMetadata: { contentType: audioFile.type || 'audio/webm' },
        });

        await env.DB.prepare('UPDATE my_songs SET r2_key = ? WHERE id = ?').bind(r2Key, songId).run();

        return json({ success: true, r2_key: r2Key, size: arrayBuffer.length });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // GET /my-songs/play/:id — stream uploaded audio
    if (path.match(/^\/my-songs\/play\/(\d+)$/) && method === 'GET') {
      const id = path.match(/^\/my-songs\/play\/(\d+)$/)[1];
      try {
        const song = await env.DB.prepare('SELECT r2_key, artist, title FROM my_songs WHERE id = ?').bind(id).first();
        if (!song || !song.r2_key) return json({ error: 'No audio uploaded for this song' }, 404);

        const obj = await env.RECORDINGS.get(song.r2_key);
        if (!obj) return json({ error: 'Audio not found' }, 404);

        const headers = {
          'Content-Type': obj.httpMetadata?.contentType || 'audio/webm',
          'Content-Disposition': `inline; filename="${song.artist} - ${song.title}.webm"`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
        };
        return new Response(obj.body, { headers });
      } catch (e) { return json({ error: e.message }, 500); }
    }

    // ── Not found (API route) — assets are auto-served by runtime ──
    return json({ error: 'Not found' }, 404);
  },
};
