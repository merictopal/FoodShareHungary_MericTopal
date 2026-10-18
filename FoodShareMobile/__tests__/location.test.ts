/**
 * Home location bootstrap (audit M1): first attempt, ONE retry, fallback only after both failed.
 */
import {
  LOCATION_FAILSAFE_GRACE_MS,
  LOCATION_OPTIONS,
  LOCATION_RETRY_OPTIONS,
  requestPositionWithRetry,
} from '../src/screens/student/home/utils';

type Call = { success: (p: any) => void; error: (e: any) => void; options: any };

const fakeGeolocation = () => {
  const calls: Call[] = [];
  const getPosition = jest.fn((success, error, options) => {
    calls.push({ success, error, options });
  });
  return { calls, getPosition };
};

const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });
const TIMEOUT = { code: 3 };
const UNAVAILABLE = { code: 2 };
const DENIED = { code: 1 };

describe('requestPositionWithRetry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('A: uses the first fix, no retry, no fallback, no timer left', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onFix = jest.fn();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, onFix, onGiveUp);

    expect(calls[0].options).toEqual(LOCATION_OPTIONS);
    calls[0].success(fix(46.07, 18.2));

    expect(onFix).toHaveBeenCalledTimes(1);
    expect(onFix).toHaveBeenCalledWith(46.07, 18.2);
    jest.runAllTimers();
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('B: first attempt times out, the one GPS retry delivers the real fix', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onFix = jest.fn();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, onFix, onGiveUp);

    calls[0].error(TIMEOUT);
    expect(getPosition).toHaveBeenCalledTimes(2);
    expect(calls[1].options).toEqual(LOCATION_RETRY_OPTIONS);
    expect(calls[1].options.enableHighAccuracy).toBe(true);
    expect(jest.getTimerCount()).toBe(1);

    calls[1].success(fix(46.07, 18.2));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('B: a first attempt that never calls back is retried by its failsafe', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, jest.fn(), onGiveUp);

    jest.advanceTimersByTime(LOCATION_OPTIONS.timeout + LOCATION_FAILSAFE_GRACE_MS - 1);
    expect(getPosition).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(getPosition).toHaveBeenCalledTimes(2);
    expect(calls[1].options).toEqual(LOCATION_RETRY_OPTIONS);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('C: both attempts fail -> fallback exactly once, no third attempt, no timer left', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onFix = jest.fn();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, onFix, onGiveUp);

    calls[0].error(UNAVAILABLE);
    calls[1].error(UNAVAILABLE);
    // A duplicate/late error from either attempt changes nothing
    calls[0].error(TIMEOUT);
    calls[1].error(TIMEOUT);
    jest.runAllTimers();

    expect(getPosition).toHaveBeenCalledTimes(2);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onFix).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('C: a retry that never calls back falls back after its failsafe', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, jest.fn(), onGiveUp);

    calls[0].error(TIMEOUT);
    jest.advanceTimersByTime(LOCATION_RETRY_OPTIONS.timeout + LOCATION_FAILSAFE_GRACE_MS);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(getPosition).toHaveBeenCalledTimes(2);
  });

  it('D: permission denied -> immediate fallback, no retry', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, jest.fn(), onGiveUp);

    calls[0].error(DENIED);
    jest.runAllTimers();
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it('a late fix after the fallback is still reported (applied in place by Home)', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onFix = jest.fn();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, onFix, onGiveUp);

    calls[0].error(TIMEOUT);
    calls[1].error(TIMEOUT);
    calls[1].success(fix(46.07, 18.2));

    expect(onGiveUp).toHaveBeenCalledTimes(1);
    expect(onFix).toHaveBeenCalledTimes(1);
  });

  it('a slow first fix arriving during the retry does not start anything else', () => {
    const { calls, getPosition } = fakeGeolocation();
    const onFix = jest.fn();
    const onGiveUp = jest.fn();
    requestPositionWithRetry(getPosition, onFix, onGiveUp);

    jest.advanceTimersByTime(LOCATION_OPTIONS.timeout + LOCATION_FAILSAFE_GRACE_MS);
    calls[0].success(fix(46.07, 18.2));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    calls[1].error(TIMEOUT);
    jest.runAllTimers();
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(getPosition).toHaveBeenCalledTimes(2);
  });
});
