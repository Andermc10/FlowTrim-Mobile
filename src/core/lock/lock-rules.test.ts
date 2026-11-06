import { LOCK_AFTER_MS, lockAvailability, shouldLockOnResume } from './lock-rules';

const NOW = 1_000_000;

describe('shouldLockOnResume', () => {
  // AC-1 de HU-84.
  it('shouldLockOnResume_After61Seconds_Locks', () => {
    expect(shouldLockOnResume(true, NOW - 61_000, NOW)).toBe(true);
  });

  it('shouldLockOnResume_After30Seconds_DoesNotLock', () => {
    expect(shouldLockOnResume(true, NOW - 30_000, NOW)).toBe(false);
  });

  it('shouldLockOnResume_ExactlySixtySeconds_DoesNotLock', () => {
    expect(shouldLockOnResume(true, NOW - LOCK_AFTER_MS, NOW)).toBe(false);
  });

  it('shouldLockOnResume_LockDisabled_NeverLocks', () => {
    expect(shouldLockOnResume(false, NOW - 3_600_000, NOW)).toBe(false);
  });

  it('shouldLockOnResume_NeverBackgrounded_DoesNotLock', () => {
    expect(shouldLockOnResume(true, null, NOW)).toBe(false);
  });
});

describe('lockAvailability', () => {
  it.each([
    [0, 'notEnrolled'],
    [1, 'available'],
    [2, 'available'],
    [3, 'available'],
  ] as const)('lockAvailability_Level%i_Returns%s', (level, expected) => {
    expect(lockAvailability(level)).toBe(expected);
  });
});
