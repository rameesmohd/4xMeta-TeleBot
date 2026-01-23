function isPermanentTelegramError(err) {
  const code = err?.response?.error_code;
  const desc = (err?.response?.description || "").toLowerCase();

  // Common permanent failures (don’t retry)
  return (
    code === 403 || code === 400 ||
    desc.includes("bot was blocked by the user") ||
    desc.includes("user is deactivated") ||
    desc.includes("chat not found") ||
    desc.includes("forbidden: bot was blocked")
  );
}

export default isPermanentTelegramError;