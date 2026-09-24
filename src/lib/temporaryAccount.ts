export function temporaryIdentityError(name: string, tag: string) {
  if (!/^[^#\u0000-\u001f\u007f]{2,32}$/.test(name.trim())) return "O nome deve ter de 2 a 32 caracteres, sem #.";
  if (!/^[A-Za-z0-9]{1,4}$/.test(tag)) return "A tag deve ter de 1 a 4 caracteres: somente letras de A a Z e números, sem espaços.";
  return "";
}
