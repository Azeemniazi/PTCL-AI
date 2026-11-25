import { streamChatReply } from '../shared/chatStream';
import type { AssistantMessage } from './Assistant';

export interface Conversation {
  id: string;
  title: string;
  updated: number | string;
  messages: AssistantMessage[];
}

interface Attachments {
  image?: { file: File; url: string };
  document?: { name: string; waitUntilReady: () => Promise<void> };
}

interface AssistantCallbacks {
  getAttachments: () => Attachments;
  getResponseStyle: () => 'concise' | 'balanced' | 'detailed';
  onTurn: (text: string, firstMessage: boolean, usingImage: boolean, presentation: 'full' | 'floating') => void;
  onReply: () => void;
  onImageResult: (filename: string) => void;
  notify: (message: string) => void;
}

const historyKey = 'cloudcore-chats';
const previewPrefix = 'This is the CloudCore AI frontend preview';

function loadConversations(): Conversation[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(historyKey) || '[]');
    if (Array.isArray(saved)) return saved.filter(chat => typeof chat?.id === 'string' && typeof chat?.title === 'string' && Array.isArray(chat?.messages));
  } catch { /* Unavailable or invalid browser storage starts with an empty history. */ }
  return [];
}

function previewReply(text: string) {
  if (/document|pdf|summari/i.test(text)) return 'Open Document Insight to select or drag in a PDF, DOCX, PPTX, XLSX or text file (up to 50 MB). You can explore an example summary and its Key Points and Actions tabs. Analysis of your own files will be available once an AI service is connected.';
  if (/image|picture/i.test(text)) return 'Open Image Analysis to upload a JPG, PNG or WEBP image (up to 20 MB), or load one from an HTTPS URL. You can preview the image now. Object detection, OCR and contextual analysis require an AI service connection.';
  return `${previewPrefix}. Connect an AI service to receive live answers. You can already explore Document Insight, preview uploaded images and revisit conversations in Chat History.`;
}

function smallTalkReply(text: string, hasHistory: boolean): string | undefined {
  const prompt = text.toLowerCase().replace(/[.!?]+$/u, '').trim();
  if (/^(?:hi|hello|hey)(?: there| pip| cloudcore(?: ai)?)?$/u.test(prompt)) {
    return hasHistory ? 'Hey! I’m here.' : 'Hey! What can I help you with?';
  }
  if (/^(?:hi[, ]+|hello[, ]+|hey[, ]+)?how (?:are you|are you doing)$/u.test(prompt)) {
    return 'I’m doing well and ready to help. How are you?';
  }
  if (/^(?:good morning|good afternoon|good evening)$/u.test(prompt)) {
    return text.charAt(0).toUpperCase() + text.slice(1).replace(/[.!?]+$/u, '') + '! What can I help you with?';
  }
  if (/^(?:salaam|salam|assalamu alaikum|assalam o alaikum|as-salamu alaykum|السلام علیکم)$/u.test(prompt)) {
    return 'Wa alaikum assalam! How can I help?';
  }
  if (hasHistory && /^(?:thanks(?: pip)?|thank you(?: pip)?|thanks so much|shukriya)$/u.test(prompt)) {
    return 'You’re welcome!';
  }
}

async function analyzeImage(file: File, text: string) {
  const form = new FormData();
  form.append('question', text);
  form.append('image', file);
  const response = await fetch('/api/vision', { method: 'POST', headers: { 'x-requested-with': 'CloudCoreAI' }, body: form });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || error?.detail || `Vision request failed (${response.status})`);
  }
  return await response.json() as { answer?: string; imageUrl?: string };
}

export function createAssistantController({ getAttachments, getResponseStyle, onTurn, onReply, onImageResult, notify }: AssistantCallbacks) {
  const state = { chats: loadConversations(), messages: [] as AssistantMessage[], currentId: null as string | null, draft: '' };

  function persist() {
    try { localStorage.setItem(historyKey, JSON.stringify(state.chats, (key, value) => key === 'streaming' ? undefined : value)); }
    catch { notify('Your browser could not save chat history.'); }
  }

  function startNew() {
    state.messages = [];
    state.currentId = null;
    state.draft = '';
  }

  async function send(prompt: string, presentation: 'full' | 'floating' = 'full') {
    const { image, document } = getAttachments();
    const text = prompt.trim() || (image ? `Please analyze the attached image "${image.file.name}" thoroughly and highlight key observations.`
      : document ? `Please summarize "${document.name}" and highlight key takeaways and action items.` : '');
    if (!text) return;

    const firstMessage = state.messages.length === 0;
    const history = state.messages.filter(message => typeof message?.content === 'string' && message.content.trim() && !message.streaming &&
      !message.content.startsWith(previewPrefix)).slice(-10).map(({ role, content }) => ({ role, content: content.trim() }));
    const quickReply = !image && !document ? smallTalkReply(text, history.length > 0) : undefined;
    const live = quickReply === undefined && typeof fetch === 'function';
    const user: AssistantMessage = { role: 'user', content: text, ...(image ? { image: image.url, imageName: image.file.name, imageSize: image.file.size } : {}) };
    const reply: AssistantMessage = { role: 'assistant', content: quickReply ?? (live ? '' : previewReply(text)), streaming: live || undefined };
    const messages = [...state.messages, user, reply];
    const id = state.currentId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const title = (messages.find(message => message.role === 'user')?.content ?? text).slice(0, 90);
    state.currentId = id;
    state.messages = messages;
    state.chats = [{ id, title, updated: Date.now(), messages }, ...state.chats.filter(chat => chat.id !== id)];
    persist();
    onTurn(text, firstMessage, Boolean(image), presentation);
    if (!live) return;

    const update = () => { if (state.currentId === id) onReply(); };
    try {
      if (image) {
        const result = await analyzeImage(image.file, text);
        reply.content = result.answer || 'No analysis returned.';
        if (result.imageUrl) user.image = result.imageUrl;
        if (state.chats.some(chat => chat.id === id)) onImageResult(image.file.name);
      } else {
        await document?.waitUntilReady();
        const style = getResponseStyle();
        const hint = style === 'concise' ? '\n\n[Preference: Keep your answer concise, direct, and bulleted.]'
          : style === 'detailed' ? '\n\n[Preference: Provide a comprehensive executive breakdown with structured headings and actionable recommendations.]' : '';
        await streamChatReply('/api/chat?stream=true', { message: text + hint, history, use_rag: false, stream: true }, reply, update);
      }
    } catch (error) {
      reply.content = `AI chat error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      delete reply.streaming;
      persist();
      update();
    }
  }

  return {
    state, startNew, send,
    open(id: string) {
      const chat = state.chats.find(item => item.id === id);
      if (!chat) return false;
      state.currentId = id;
      state.messages = chat.messages.slice();
      state.draft = '';
      return true;
    },
    remove(id: string) {
      state.chats = state.chats.filter(chat => chat.id !== id);
      if (state.currentId === id) startNew();
      persist();
    },
    clear() { state.chats = []; startNew(); persist(); },
  };
}
