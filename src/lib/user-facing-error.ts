export function toUserMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) return "Access denied.";
    if (msg.includes("unavailable") || msg.includes("DEADLINE_EXCEEDED")) return "Service temporarily unavailable. Try again.";
    if (msg.includes("not-found") || msg.includes("NOT_FOUND")) return "Resource not found.";
    if (msg.includes("already-exists") || msg.includes("ALREADY_EXISTS")) return "Item already exists.";
    if (msg.includes("network") || msg.includes("Network")) return "Network error. Check your connection.";
    if (msg.includes("unauthorized") || msg.includes("UNAUTHENTICATED")) return "Please log in again.";
    if (msg.includes("quota") || msg.includes("Quota")) return "Rate limit reached. Try again later.";
  }
  return fallback;
}
