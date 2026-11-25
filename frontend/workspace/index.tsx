import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Shell, type ShellProps } from './Shell';
import { History, Home, type OverviewProps } from './Overview';
import { Sidebar, type SidebarProps } from './Sidebar';
import { Header, type HeaderProps } from './Header';
import { MeetingLaunch, MeetingsList, type MeetingLaunchProps, type MeetingsListProps } from './MeetingsList';
import { MeetingDetail, type MeetingDetailProps } from './MeetingDetail';
import { Assistant, type AssistantProps } from './Assistant';
import { Settings, type SettingsProps } from './Settings';
import { KnowledgeHub, type KnowledgeHubProps } from './KnowledgeHub';
import { KnowledgeImport } from './KnowledgeImport';
import { PipChat, type PipChatProps } from './PipChat';
import type { ComponentProps } from 'react';
import { SharedDialogs, type SharedDialogProps } from './SharedDialogs';

let root: Root | undefined;
let host: HTMLElement | undefined;
let sidebarRoot: Root | undefined;
let headerRoot: Root | undefined;
let meetingsRoot: Root | undefined;
let meetingLaunchRoot: Root | undefined;
let assistantRoot: Root | undefined;
let pipChatRoot: Root | undefined;
let settingsRoot: Root | undefined;
let knowledgeRoot: Root | undefined;
let importRoot: Root | undefined;
let importHost: HTMLElement | undefined;
let importProps: ComponentProps<typeof KnowledgeImport> | undefined;
let dialogRoot: Root | undefined;
let shellRoot: Root | undefined;

function unmountOverview() {
  root?.unmount();
  root = undefined;
  host = undefined;
}

export const workspacePages = {
  mountShell(container: HTMLElement, props: ShellProps) {
    shellRoot = createRoot(container);
    // The router binds file inputs and mounts each feature immediately after this call.
    flushSync(() => shellRoot?.render(<Shell {...props} />));
  },
  unmountShell() {
    shellRoot?.unmount();
    shellRoot = undefined;
  },
  unmount() {
    sidebarRoot?.unmount();
    sidebarRoot = undefined;
    headerRoot?.unmount();
    headerRoot = undefined;
    meetingsRoot?.unmount();
    meetingsRoot = undefined;
    assistantRoot?.unmount();
    assistantRoot = undefined;
    this.closePipChat();
    settingsRoot?.unmount();
    settingsRoot = undefined;
    knowledgeRoot?.unmount();
    knowledgeRoot = undefined;
    this.closeSharedDialog();
    this.unmountMeetingLaunch();
    unmountOverview();
  },
  closeSharedDialog() {
    dialogRoot?.unmount();
    dialogRoot = undefined;
  },
  mountSharedDialog(container: HTMLElement, props: SharedDialogProps) {
    dialogRoot ??= createRoot(container);
    dialogRoot.render(<SharedDialogs key={props.kind} {...props} />);
  },
  unmountMeetingLaunch() {
    meetingLaunchRoot?.unmount();
    meetingLaunchRoot = undefined;
  },
  mountMeetingLaunch(container: HTMLElement, props: MeetingLaunchProps) {
    meetingLaunchRoot ??= createRoot(container);
    meetingLaunchRoot.render(<MeetingLaunch {...props} />);
  },
  mountMeetings(container: HTMLElement, props: MeetingsListProps) {
    meetingsRoot ??= createRoot(container);
    meetingsRoot.render(<MeetingsList {...props} />);
  },
  mountMeetingDetail(container: HTMLElement, props: MeetingDetailProps) {
    meetingsRoot ??= createRoot(container);
    meetingsRoot.render(<MeetingDetail {...props} />);
  },
  mountAssistant(container: HTMLElement, props: AssistantProps) {
    assistantRoot ??= createRoot(container);
    assistantRoot.render(<Assistant {...props} />);
  },
  mountPipChat(container: HTMLElement, props: PipChatProps) {
    pipChatRoot ??= createRoot(container);
    pipChatRoot.render(<PipChat {...props} />);
  },
  closePipChat() {
    pipChatRoot?.unmount();
    pipChatRoot = undefined;
  },
  mountSettings(container: HTMLElement, props: SettingsProps) {
    settingsRoot ??= createRoot(container);
    settingsRoot.render(<Settings {...props} />);
  },
  mountKnowledge(container: HTMLElement, props: KnowledgeHubProps) {
    knowledgeRoot ??= createRoot(container);
    knowledgeRoot.render(<KnowledgeHub {...props} />);
  },
  openKnowledgeImport(props: Omit<ComponentProps<typeof KnowledgeImport>, 'onClose' | 'openVersion'>) {
    if (importRoot && importProps) {
      importProps = { ...importProps, openVersion: importProps.openVersion + 1 };
    } else {
      importHost = document.createElement('div');
      document.body.append(importHost);
      importRoot = createRoot(importHost);
      importProps = { ...props, onClose: () => workspacePages.closeKnowledgeImport(), openVersion: 0 };
    }
    importRoot.render(<KnowledgeImport {...importProps} />);
    window.dispatchEvent(new Event('cloudcore:import-status'));
  },
  hasKnowledgeImport() { return Boolean(importRoot); },
  reopenKnowledgeImport() {
    if (!importProps || !importRoot) return;
    const next = { ...importProps, openVersion: importProps.openVersion + 1 };
    importProps = next;
    importRoot.render(<KnowledgeImport {...next} />);
  },
  updateKnowledgeImportFolders(scope: KnowledgeHubProps['scope'], folders: KnowledgeHubProps['folders']) {
    if (!importProps || importProps.scope !== scope || importProps.folders === folders) return;
    importProps = { ...importProps, folders };
    importRoot?.render(<KnowledgeImport {...importProps} />);
  },
  closeKnowledgeImport() {
    if (!importRoot) return;
    importRoot?.unmount();
    importHost?.remove();
    importRoot = undefined;
    importHost = undefined;
    importProps = undefined;
    window.dispatchEvent(new Event('cloudcore:import-status'));
  },
  mountSidebar(container: HTMLElement, props: SidebarProps) {
    sidebarRoot ??= createRoot(container);
    sidebarRoot.render(<Sidebar {...props} />);
  },
  mountHeader(container: HTMLElement, props: HeaderProps) {
    headerRoot ??= createRoot(container);
    headerRoot.render(<Header {...props} />);
  },
  mount(container: HTMLElement, props: OverviewProps) {
    if (host !== container) {
      unmountOverview();
      root = createRoot(container);
      host = container;
    }
    root?.render(container.dataset.workspacePage === 'history' ? <History {...props} /> : <Home {...props} />);
  },
};
