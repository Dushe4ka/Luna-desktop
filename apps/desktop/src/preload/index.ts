import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type LunaAPI, type LunaSnapshot, type MenuActionId, type PanelView, type TranscriptItem } from '../shared/luna'

// Узкий мост: интерфейс получает только перечисленные функции, без прямого доступа к Node.js.
const luna: LunaAPI = {
  getSnapshot: () => ipcRenderer.invoke(IPC.snapshot),

  onSnapshot: (callback) => {
    const listener = (_event: unknown, snapshot: LunaSnapshot): void => callback(snapshot)
    ipcRenderer.on(IPC.state, listener)
    return () => ipcRenderer.removeListener(IPC.state, listener)
  },

  onPanelView: (callback) => {
    const listener = (_event: unknown, view: PanelView): void => callback(view)
    ipcRenderer.on(IPC.panelView, listener)
    return () => ipcRenderer.removeListener(IPC.panelView, listener)
  },

  openPanel: (view) => ipcRenderer.send(IPC.openPanel, view),
  hidePanel: () => ipcRenderer.send(IPC.hidePanel),
  action: (id: MenuActionId) => ipcRenderer.send(IPC.action, id),
  submit: (text: string) => ipcRenderer.send(IPC.submit, text),
  dragBy: (dx: number, dy: number) => ipcRenderer.send(IPC.dragBy, dx, dy),
  stop: () => ipcRenderer.send(IPC.stop),
  decide: (id: string, allow: boolean) => ipcRenderer.send(IPC.decide, id, allow),
  listMemory: () => ipcRenderer.invoke(IPC.memoryList),
  deleteMemory: (kind, id) => ipcRenderer.send(IPC.memoryDelete, kind, id),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  saveSettings: (patch) => ipcRenderer.invoke(IPC.settingsSave, patch),
  saveOpenAIKey: (value: string) => ipcRenderer.invoke(IPC.settingsKey, value),
  saveProviderKey: (providerId, value) => ipcRenderer.invoke(IPC.settingsProviderKey, providerId, value),
  hasProviderKey: (providerId) => ipcRenderer.invoke(IPC.settingsHasKey, providerId),
  testProvider: () => ipcRenderer.invoke(IPC.settingsTest),
  getTranscript: () => ipcRenderer.invoke(IPC.transcriptGet),
  onTranscript: (callback) => {
    const listener = (_event: unknown, items: TranscriptItem[]): void => callback(items)
    ipcRenderer.on(IPC.transcript, listener)
    return () => ipcRenderer.removeListener(IPC.transcript, listener)
  }
}

contextBridge.exposeInMainWorld('luna', luna)
