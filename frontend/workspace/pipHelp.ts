import type { SettingsProps } from './Settings';

type HelpPage = 'settings' | 'meetings' | 'images' | 'history';
type HelpLink = { label: string; href: string };
type HelpTopic = { id: string; prompt: string; match: RegExp; text: string; action?: HelpLink };
type HelpState = { role: string; tab: SettingsProps['tab']; prefs: SettingsProps['prefs']; pipMode: 'roaming' | 'docked' | 'off' };

const settingsLink = (tab: SettingsProps['tab'], label: string) => ({ label, href: '#settings?tab=' + tab });

function settingsTopics({ role, prefs, pipMode }: HelpState): HelpTopic[] {
  const motion = { auto: 'System Default', on: 'Always On', off: 'Off (Static)' }[prefs.motionMode];
  const style = { concise: 'Concise', balanced: 'Balanced', detailed: 'Executive Detail' }[prefs.responseStyle];
  const mascot = { roaming: 'Roaming', docked: 'Locked in place', off: 'Off' }[pipMode];
  return [
    { id: 'users', prompt: 'How do I manage users?', match: /\b(?:workspace users?|user accounts?|manage users?|invite|provision|(?:add|create|reset|delete) (?:a |an )?(?:user|admin|member|account))\b/i,
      text: role === 'dev' || role === 'admin'
        ? 'Open **Settings → Security → Workspace User Management**. ' + (role === 'dev'
          ? 'Dev accounts can create Admin or User accounts and manage credentials.'
          : 'Admins can create standard User accounts with an initial password.')
        : 'Workspace User Management is available to admins and dev accounts. Ask a workspace admin to create or manage another user.',
      ...(role === 'dev' || role === 'admin' ? { action: settingsLink('security', 'Open Security') } : {}) },
    { id: 'password', prompt: 'How do I change my password?', match: /\b(?:password|credentials?|passcode)\b/i,
      text: 'Open **Settings → Security → Change Your Password**. Enter your current password and a new password of at least six characters, confirm it, and select **Update Password**.',
      action: settingsLink('security', 'Open Security') },
    { id: 'pip', prompt: 'How do I keep Pip in one place?', match: /\b(?:pip|mascot|roam(?:ing)?|padlock|lock (?:him|it)|move (?:him|the cloud))\b/i,
      text: 'Pip is currently set to **' + mascot + '**. Drag Pip to a spot, then click the padlock beside him. You can also choose **Roaming**, **Locked in place**, or **Off** under **Settings → Preferences → Pip mascot**.',
      action: settingsLink('preferences', 'Open Preferences') },
    { id: 'motion', prompt: 'How do I turn off animations?', match: /\b(?:animation\w*|motion|ambient|effects|static)\b/i,
      text: 'Background Motion Animations is set to **' + motion + '**. In **Settings → Preferences**, choose **Off (Static)** to reduce workspace motion, or **System Default** to follow your device settings.',
      action: settingsLink('preferences', 'Open Preferences') },
    { id: 'notifications', prompt: 'How do I mute notifications?', match: /\b(?:notification\w*|alerts?|mute|toasts?)\b/i,
      text: 'Workspace Toast Alerts are **' + (prefs.notifications === 'off' ? 'Muted' : 'Enabled') + '**. Open **Settings → Preferences → Workspace Toast Alerts** and choose **Muted** or **Enabled**.',
      action: settingsLink('preferences', 'Open Preferences') },
    { id: 'history', prompt: 'How do I export chat history?', match: /\b(?:export|chat history|conversations?|local data|clear chats?)\b/i,
      text: 'In **Settings → Preferences → Local Data & Conversation Storage**, use **Export Chat History (.json)** to download a copy of the chats saved on this device. **Clear All Local Conversations** opens a confirmation before clearing them.',
      action: settingsLink('preferences', 'Open Preferences') },
    { id: 'style', prompt: 'How do I get shorter replies?', match: /\b(?:responses?|replies|reply|answers?|concise|shorter|verbose|executive detail)\b/i,
      text: 'The Assistant response style is **' + style + '**. Open **Settings → Preferences → Default Response Style** and choose **Concise**, **Balanced**, or **Executive Detail**.',
      action: settingsLink('preferences', 'Open Preferences') },
    { id: 'rag', prompt: 'How do I ask questions about workspace files?', match: /\b(?:rag|grounding|workspace (?:files|documents)|knowledge hub|citations?|attached (?:document|file))\b/i,
      text: 'To search workspace files and get citations, open **Knowledge Hub**, then open **Ask Knowledge** or Pip. Opening a folder or previewing a file gives Pip that search scope. The regular Assistant can use a document you attach to that chat.',
      action: { label: 'Open Knowledge Hub', href: '#documents' } },
    { id: 'services', prompt: 'How can I check service status?', match: /\b(?:integrations?|service|health|offline|status|model|connected|refresh status|meeting capacity)\b/i,
      text: 'Open **Settings → Integrations** to see the AI connection and meeting capacity. Use **Refresh Status** to check again.',
      action: settingsLink('integrations', 'Open Integrations') },
    { id: 'profile', prompt: 'How do I edit my profile?', match: /\b(?:profile|display name|email|username|time zone|account|role)\b/i,
      text: 'Open **Settings → Account** to edit your name and email. Select **Save Profile Changes** when done. Username, role, and time zone are displayed as read-only fields.',
      action: settingsLink('account', 'Open Account') },
  ];
}

const guides: Record<Exclude<HelpPage, 'settings'>, { label: string; intro: string; topics: HelpTopic[] }> = {
  meetings: { label: 'Meetings AI', intro: 'Ask how to record a meeting, or open a meeting to ask about its transcript.', topics: [
    { id: 'record', prompt: 'How do I start a recording?', match: /\b(?:record\w*|join|launch|teams|notetaker|start)\b/i,
      text: 'Use **New Meeting** in Meetings AI, paste your Teams meeting link, and confirm recording consent. The meeting organizer may need to admit the notetaker from the lobby.' },
    { id: 'transcript', prompt: 'Where do I find a transcript?', match: /\b(?:transcript|minutes|mom|summary|action items|audio)\b/i,
      text: 'Open the meeting and choose **Transcript**, **MOM** for minutes, or **Audio**. Open Pip inside that meeting to ask a question using its available meeting evidence.' },
  ]},
  images: { label: 'Image Studio', intro: 'I can help with prompts, image generation, and restoring work from the gallery.', topics: [
    { id: 'prompts', prompt: 'How do I write a better image prompt?', match: /\b(?:prompt|generat\w*|create|aspect ratio|style)\b/i,
      text: 'In **Image Studio → Create**, describe the subject, setting, and lighting. Add the framing or style you want. For example, “A modern server room, eye-level wide shot, cool blue lighting, realistic editorial photography.” Choose the aspect ratio, then generate.' },
    { id: 'gallery', prompt: 'How do I reuse an image?', match: /\b(?:gallery|reuse|remix|reference|download|saved)\b/i,
      text: 'In **Image Studio → Gallery**, open an image to download it, reuse its prompt, or start a remix with that image as the reference.' },
  ]},
  history: { label: 'Chat History', intro: 'I can help you find, reopen, or export an Assistant conversation.', topics: [
    { id: 'reopen', prompt: 'How do I reopen a chat?', match: /\b(?:reopen|find|search|continue|saved|restore|where)\b/i,
      text: 'Use the search field in **Chat History** to find a saved conversation, then select it to continue in AI Assistant.' },
    { id: 'export', prompt: 'How do I export chats?', match: /\b(?:export|download|clear|delete)\b/i,
      text: 'Open **Settings → Preferences → Local Data & Conversation Storage** to export chats as JSON or clear all conversations saved on this device.',
      action: settingsLink('preferences', 'Open Preferences') },
  ]},
};

const settingsSections = {
  account: { label: 'Account', topics: ['profile', 'services', 'password'] },
  preferences: { label: 'Preferences', topics: ['pip', 'style', 'notifications'] },
  security: { label: 'Security', topics: ['password', 'users'] },
  integrations: { label: 'Integrations', topics: ['services', 'style'] },
};

export function getPipHelp(page: HelpPage, state: HelpState) {
  if (page !== 'settings') return { ...guides[page], suggested: guides[page].topics };
  const section = settingsSections[state.tab];
  const topics = settingsTopics(state);
  return {
    label: 'Settings · ' + section.label,
    intro: 'I can explain these settings, show your current preferences, and take you to the right control.',
    topics,
    suggested: section.topics.flatMap(id => topics.filter(topic => topic.id === id)),
  };
}

export function answerPipHelp(guide: ReturnType<typeof getPipHelp>, prompt: string, previous?: string) {
  const followUp = /\b(?:where is (?:it|that)|how do i (?:do|change|find) (?:it|that)|what about (?:it|that)|show me)\b/i;
  const topic = guide.topics.find(item => item.match.test(prompt)) ??
    (followUp.test(prompt) ? guide.topics.find(item => item.id === previous) : undefined);
  return topic ? { text: topic.text, action: topic.action, topic: topic.id } : {
    text: 'Try one of these questions about **' + guide.label + '**.\n\n' +
      guide.suggested.map(item => '- ' + item.prompt).join('\n'),
  };
}
