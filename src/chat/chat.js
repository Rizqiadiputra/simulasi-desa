// Layanan obrolan: coba Claude via /api/chat, kalau tidak tersedia pakai otak lokal.
import { buildContext, systemPrompt, localReply, openingLine } from './brain.js';

export class ChatService {
  constructor(app) {
    this.app = app;
    this.llm = null; // null = belum dicek, true/false
    this.busy = false;
    fetch('/api/chat/status').then((r) => (r.ok ? r.json() : { llm: false })).then((j) => { this.llm = !!j.llm; }).catch(() => { this.llm = false; });
  }

  log(id) {
    const st = this.app.state;
    st.chats ||= {};
    return (st.chats[id] ||= []);
  }
  push(id, from, text, src) {
    const st = this.app.state, l = this.log(id);
    l.push({ from, text, day: this.app.sim.day, minute: Math.floor(st.clock.minute), src });
    if (l.length > 60) l.splice(0, l.length - 60);
  }

  // Sapaan pembuka kalau belum ngobrol hari ini
  greet(c) {
    const l = this.log(c.id);
    const last = l[l.length - 1];
    if (last && last.day === this.app.sim.day) return;
    this.push(c.id, 'npc', openingLine(buildContext(this.app, c)), 'lokal');
  }

  async send(c, text) {
    text = text.trim().slice(0, 300);
    if (!text || this.busy) return null;
    this.push(c.id, 'me', text);
    this.busy = true;
    const x = buildContext(this.app, c);
    let reply = null, src = 'lokal';
    if (this.llm !== false) {
      try {
        const messages = this.log(c.id).slice(-16).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: systemPrompt(x), messages }) });
        if (r.status === 503) this.llm = false;
        if (r.ok) { const j = await r.json(); if (j.reply) { reply = j.reply; src = 'claude'; this.llm = true; } }
      } catch { /* jaringan gagal -> lokal */ }
    }
    if (!reply) {
      await new Promise((res) => setTimeout(res, 450 + Math.random() * 600)); // jeda "mengetik"
      reply = localReply(x, text);
    }
    this.push(c.id, 'npc', reply, src);
    this.busy = false;
    return reply;
  }
}
