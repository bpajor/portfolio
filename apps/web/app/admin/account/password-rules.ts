export function validateAdminPassword(password: string) {
  if (password.length < 12) {
    return "Use at least 12 characters.";
  }
  if (!/[a-z]/.test(password)) {
    return "Add a lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Add an uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Add a number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Add a symbol.";
  }
  return "";
}
