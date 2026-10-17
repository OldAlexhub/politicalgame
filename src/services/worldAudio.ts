type SoundHandle = {
  setVolume(value: number): SoundHandle;
  setNumberOfLoops(value: number): SoundHandle;
  play(callback?: (success: boolean) => void): SoundHandle;
  stop(callback?: () => void): SoundHandle;
  release(): void;
};

type SoundConstructor = {
  new (filename: string, basePath: string, onError?: (error: unknown) => void): SoundHandle;
  MAIN_BUNDLE: string;
  setCategory(category: string, mixWithOthers?: boolean): void;
};

let ambience: SoundHandle | undefined;

function soundLibrary(): SoundConstructor {
  const Sound = require('react-native-sound') as SoundConstructor;
  Sound.setCategory('Ambient', true);
  return Sound;
}

export function setWorldAmbience(enabled: boolean) {
  if (!enabled) {
    const current = ambience;
    ambience = undefined;
    current?.stop(() => current.release());
    return;
  }
  if (ambience) return;
  const Sound = soundLibrary();
  let current: SoundHandle;
  current = new Sound('world_ambience.wav', Sound.MAIN_BUNDLE, error => {
    if (error) { current.release(); if (ambience === current) ambience = undefined; }
  });
  ambience = current;
  current.setVolume(0.12).setNumberOfLoops(-1).play();
}

export function playWorldCue(cue: 'breaking_news.wav' | 'war_horn.wav', enabled: boolean) {
  if (!enabled) return;
  const Sound = soundLibrary();
  let sound: SoundHandle | undefined;
  sound = new Sound(cue, Sound.MAIN_BUNDLE, error => {
    if (error) sound?.release();
  });
  sound.setVolume(cue === 'war_horn.wav' ? 0.28 : 0.2).play(() => sound?.release());
}

