const IGNORABLE_MESSAGE_ERROR_PATTERNS = [
  /Receiving end does not exist/i,
  /Could not establish connection/i,
  /The message port closed before a response was received/i,
  /message port closed/i
];

export function isIgnorableRuntimeMessageError(error) {
  const message = String(error?.message || error || '');
  return IGNORABLE_MESSAGE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export async function sendRuntimeMessage(message, context = 'runtime message') {
  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    if (!isIgnorableRuntimeMessageError(error)) {
      console.warn(`[FavorAI] Failed to send ${context}.`, error);
    }
    return false;
  }
}
