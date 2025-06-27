export type MyAppUIActions = {
  run_echo: { textToEcho: string }
}

export type SlackUIActions = {
  sendMessage: { channel: string; message: string; threadTs?: string }
  selectConversation: { channel: string }
  refreshConversations: {}
  refreshMessages: { channel: string }
  logoutSlack: {}
  checkAuthStatus: {}
  toggleDeveloperMode: {}
  executeNaturalLanguage: { naturalLanguageCommand: string }
  executeSlackFunction: { functionName: string; functionParams?: string }
}
