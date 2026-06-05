function cloneLogs(logs) {
  return Array.isArray(logs) ? logs.map((entry) => ({ ...entry })) : [];
}

export function normalizeInterruptedAnalysisStatus(status, interruptedMessage, hasActiveController) {
  if (!status || status.state !== 'analyzing' || hasActiveController) {
    return { status, normalized: false };
  }

  const normalizedStatus = {
    ...status,
    state: 'idle',
    percentage: 0,
    actions: [],
    explanation: '',
    lastError: interruptedMessage,
    retryable: true,
    logs: [...cloneLogs(status.logs), { text: interruptedMessage, type: 'warning' }]
  };

  return { status: normalizedStatus, normalized: true };
}
