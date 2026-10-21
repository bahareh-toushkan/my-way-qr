// 프로필은 이 휴대폰의 브라우저에만 저장 (서버로 보내지 않음, 화면 변환 요청 때 설정값만 전달)
import { normalizeProfile } from '../../shared/profile';
import type { Profile } from '../../shared/types';

const KEY = 'myway.profile.v1';

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 사생활 보호 모드 등: 이번 접속 동안만 메모리에 유지 */
  }
}

export function sessionGet(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function sessionSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}
