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
let ambienceRequested = false;

function soundLibrary(): SoundConstructor {
  const imported = require('react-native-sound') as SoundConstructor & {default?: SoundConstructor};
  const Sound = imported.default ?? imported;
  // Use the device's media volume. Android maps "Ambient" to the notification
  // stream, which is commonly muted even when the user expects game audio.
  Sound.setCategory('Playback', true);
  return Sound;
}

export function setGameMusic(enabled: boolean) {
  ambienceRequested = enabled;
  if (!enabled) {
    const current = ambience;
    ambience = undefined;
    current?.stop(() => current.release());
    return;
  }
  if (ambience) return;
  const Sound = soundLibrary();
  let current: SoundHandle;
  current = new Sound('playwhileplay.wav', Sound.MAIN_BUNDLE, error => {
    if (error || !ambienceRequested || ambience !== current) {
      current.release();
      if (ambience === current) ambience = undefined;
      return;
    }
    current.setVolume(0.24).setNumberOfLoops(-1).play(success => {
      if (!success) {
        current.release();
        if (ambience === current) ambience = undefined;
      }
    });
  });
  ambience = current;
}

export function playWorldCue(cue: 'breaking_news.wav' | 'war_horn.wav', enabled: boolean) {
  if (!enabled) return;
  const Sound = soundLibrary();
  let sound: SoundHandle | undefined;
  sound = new Sound(cue, Sound.MAIN_BUNDLE, error => {
    if (error) {
      sound?.release();
      return;
    }
    sound?.setVolume(cue === 'war_horn.wav' ? 0.72 : 0.58).play(() => sound?.release());
  });
}

