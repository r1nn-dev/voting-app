export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다.`);
  }
  return value;
}
