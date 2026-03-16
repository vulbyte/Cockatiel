/**
 * A utility class to handle Text-to-Speech (TTS) using the Web Speech API.
 */
export default class TTSManager {
  constructor() {
    /** @type {SpeechSynthesisVoice[]} */
    this.voices = [];
    this._initVoices();
  }

  /**
   * Initializes and retrieves available browser voices.
   * @private
   */
  _initVoices() {
    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices();
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Returns the full list of available TTS voices.
   * @returns {SpeechSynthesisVoice[]}
   */
  getAllVoices() {
    return this.voices;
  }

  Call(message, options = {}) {
    if (!message) {
      console.error("TTSManager: Message is required.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);

    // Destructure options with defaults
    const { 
      voiceName, 
      pitch = 1, 
      rate = 1, 
      volume = 1, 
      lang = 'en-US' 
    } = options;

    // Set basic properties
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;
    utterance.lang = lang;

    // Find specific voice if requested
    if (voiceName) {
      const selectedVoice = this.voices.find(v => v.name === voiceName);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  }
}


