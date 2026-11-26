
const SOUND_FILE = "/flejexa_notification_chime.wav";
const SOUND_STORAGE_KEY = "flejexa_notification_sound_enabled";

let soundPlayer: HTMLAudioElement | null = null;

function getSoundPlayer(): HTMLAudioElement | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!soundPlayer) {
    soundPlayer = new Audio(SOUND_FILE);
    soundPlayer.preload = "auto";
    soundPlayer.volume = 0.65;
  }

  return soundPlayer;
}

export function isFlejexaNotificationSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(SOUND_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}

export async function enableFlejexaNotificationSound(): Promise<boolean> {
  const player = getSoundPlayer();

  if (!player) {
    return false;
  }

  try {
    player.currentTime = 0;
    await player.play();

    window.localStorage.setItem(SOUND_STORAGE_KEY, "true");

    return true;
  } catch (error) {
    console.warn(
      "FleJexa notification sound could not be enabled:",
      error
    );

    return false;
  }
}

export function disableFlejexaNotificationSound(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SOUND_STORAGE_KEY);
  } catch (error) {
    console.warn(
      "FleJexa notification sound preference could not be cleared:",
      error
    );
  }
}

export function playFlejexaNotificationSound(): void {
  if (!isFlejexaNotificationSoundEnabled()) {
    return;
  }

  const player = getSoundPlayer();

  if (!player) {
    return;
  }

  try {
    player.currentTime = 0;

    void player.play().catch((error) => {
      console.warn(
        "FleJexa notification sound playback was blocked:",
        error
      );
    });
  } catch (error) {
    console.warn(
      "FleJexa notification sound could not play:",
      error
    );
  }
      }
