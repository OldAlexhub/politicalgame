import {playWorldCue, setGameMusic} from '../src/services/worldAudio';

type MockSoundInstance = {
  filename: string;
  finishLoad(error?: unknown): void;
  setVolume: jest.Mock;
  setNumberOfLoops: jest.Mock;
  play: jest.Mock;
  stop: jest.Mock;
  release: jest.Mock;
};

type MockSoundConstructor = {
  instances: MockSoundInstance[];
  setCategory: jest.Mock;
};

const MockSound = require('react-native-sound').default as MockSoundConstructor;

beforeEach(() => {
  setGameMusic(false);
  MockSound.instances.length = 0;
  MockSound.setCategory.mockClear();
});

afterEach(() => setGameMusic(false));

test('background music waits for loading and then loops through the media stream', () => {
  setGameMusic(true);
  const sound = MockSound.instances[0];

  expect(sound.filename).toBe('playwhileplay.wav');
  expect(MockSound.setCategory).toHaveBeenCalledWith('Playback', true);
  expect(sound.play).not.toHaveBeenCalled();

  sound.finishLoad();

  expect(sound.setVolume).toHaveBeenCalledWith(0.24);
  expect(sound.setNumberOfLoops).toHaveBeenCalledWith(-1);
  expect(sound.play).toHaveBeenCalledTimes(1);
});

test('disabling music stops and releases a loaded track', () => {
  setGameMusic(true);
  const sound = MockSound.instances[0];
  sound.finishLoad();

  setGameMusic(false);

  expect(sound.stop).toHaveBeenCalledTimes(1);
  expect(sound.release).toHaveBeenCalledTimes(1);
});

test('a disabled track cannot begin playing after a late load callback', () => {
  setGameMusic(true);
  const sound = MockSound.instances[0];
  setGameMusic(false);

  sound.finishLoad();

  expect(sound.play).not.toHaveBeenCalled();
  expect(sound.release).toHaveBeenCalledTimes(1);
});

test('world cues wait for loading, use an audible volume, and release on completion', () => {
  playWorldCue('war_horn.wav', true);
  const sound = MockSound.instances[0];

  expect(sound.play).not.toHaveBeenCalled();
  sound.finishLoad();

  expect(sound.setVolume).toHaveBeenCalledWith(0.72);
  expect(sound.play).toHaveBeenCalledTimes(1);
  const onComplete = sound.play.mock.calls[0][0] as (success: boolean) => void;
  onComplete(true);
  expect(sound.release).toHaveBeenCalledTimes(1);
});

test('a failed cue load is released without attempting playback', () => {
  playWorldCue('breaking_news.wav', true);
  const sound = MockSound.instances[0];

  sound.finishLoad(new Error('decode failed'));

  expect(sound.play).not.toHaveBeenCalled();
  expect(sound.release).toHaveBeenCalledTimes(1);
});
