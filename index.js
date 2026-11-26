const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are PassAI, a JAMB/WAEC tutor for Nigerian students. Answer in simple English a 16-year-old in Abuja will understand. Use Nigerian examples. Follow JAMB format. After explaining, ask 1 practice JAMB question. Keep answers short.`;

app.get('/', (req, res) => {
  res.send(`
  <html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>PassAI</title>
  <style>body{font-family:sans-serif;padding:20px;background:#f5f5f5} .box{background:white;padding:20px;border-radius:12px;max-width:500px;margin:auto} input,select,button{width:100%;padding:12px;margin:8px 0;border-radius:8px;border:1px solid #ddd} button{background:#00a859;color:white;font-weight:bold;border:none} #ans{white-space:pre-wrap;background:#e8f5e9;padding:15px;border-radius:8px;margin-top:10px}</style></head>
  <body><div class="box"><h2>🎓 PassAI - JAMB/WAEC AI Tutor</h2>
  <p>Ask any JAMB question</p>
  <input id="phone" placeholder="Your phone e.g 0803..." />
  <select id="subject"><option>Biology</option><option>Chemistry</option><option>Physics</option><option>Mathematics</option><option>English</option><option>Economics</option><option>Government</option></select>
  <input id="msg" placeholder="e.g Explain photosynthesis" />
  <button onclick="ask()">Ask PassAI</button><div id="ans"></div>
  <script>async function ask(){document.getElementById('ans').innerText='Thinking...'; const r=await fetch('/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:document.getElementById('phone').value,message:document.getElementById('msg').value,subject:document.getElementById('subject').value})}); const d=await r.json(); document.getElementById('ans').innerText=d.reply||d.error}</script>
  </div></body></html>`);
});

app.post('/ask', async (req, res) => {
  const { phone, message, subject } = req.body;
  try {
    let { data: user } = await supabase.from('users').select('*').eq('phone_number', phone).single();
    if (!user) {
      const { data: newUser } = await supabase.from('users').insert({ phone_number: phone }).select().single();
      user = newUser;
    }
    if (user.subscription_status === 'free' && user.free_questions_used >= 5) {
      return res.json({ reply: "You don use your 5 free questions! Pay 2,500 to continue." });
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `Subject: ${subject} - ${message}` }],
    });
    const aiReply = completion.choices[0].message.content;
    await supabase.from('chat_history').insert({ user_id: user.id, subject, user_message: message, ai_response: aiReply });
    await supabase.from('users').update({ free_questions_used: user.free_questions_used + 1 }).eq('id', user.id);
    res.json({ reply: aiReply });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(process.env.PORT || 3000, () => console.log('PassAI web live'));
