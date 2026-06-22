/**
 * PASystem — Southern Railway Public Address System (Trilingual)
 *
 * Uses the Web Speech API (SpeechSynthesis) with a queued delivery system
 * to announce station approaches, arrivals, and departures sequentially
 * in Malayalam (phonetic), English (en-IN), and Hindi (hi-IN).
 */

export default class PASystem {
    constructor(scene) {
        this.scene   = scene;
        this.enabled = typeof window !== 'undefined' && 'speechSynthesis' in window;
        this._queue  = [];        // Speech queue [{ text, lang, rate, pitch }]
        this._speaking = false;
        this._lastStation = null;
        this._lastState   = null;

        if (this.enabled) {
            window.speechSynthesis.getVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => {
                    this._voices = window.speechSynthesis.getVoices();
                };
            }
            this._voices = window.speechSynthesis.getVoices();
        }
    }

    /** Get best matching voice for a language */
    _getVoice(lang) {
        if (!this._voices?.length) this._voices = window.speechSynthesis.getVoices();
        if (lang === 'hi-IN') {
            return this._voices.find(v => v.lang === 'hi-IN') || null;
        }
        // Prefer en-IN for English/Malayalam phonetic
        return this._voices.find(v => v.lang === 'en-IN')
            || this._voices.find(v => v.lang.startsWith('en'))
            || null;
    }

    /** Speak text or queue it. If clear is true, cancels ongoing speech. */
    _speak(text, lang = 'en-IN', rate = 0.88, pitch = 0.95, clear = false) {
        if (!this.enabled) return;
        if (clear) {
            window.speechSynthesis.cancel();
            this._queue = [];
            this._speaking = false;
        }

        this._queue.push({ text, lang, rate, pitch });

        if (!this._speaking) {
            this._processQueue();
        }
    }

    _processQueue() {
        if (this._queue.length === 0) {
            this._speaking = false;
            return;
        }

        this._speaking = true;
        const item = this._queue.shift();
        const ut = new SpeechSynthesisUtterance(item.text);
        ut.voice = this._getVoice(item.lang);
        ut.lang = item.lang;
        ut.rate = item.rate;
        ut.pitch = item.pitch;
        ut.volume = 0.85;

        ut.onend = () => { this._processQueue(); };
        ut.onerror = () => {
            this._speaking = false;
            this._processQueue();
        };

        window.speechSynthesis.speak(ut);
    }

    /** Approach announcements (Malayalam -> English -> Hindi) */
    announceApproach(station) {
        if (station.name === this._lastStation && this._lastState === 'approach') return;
        this._lastStation = station.name;
        this._lastState   = 'approach';

        // 1. Malayalam (Phonetic English fallback)
        const mal = `Attention please. Vandi thodarnnu ${station.name} stationil praveshikkukayaanu. Shradhikkuka.`;
        this._speak(mal, 'en-IN', 0.85, 0.95, true); // Clear previous queue

        // 2. English
        const eng = `Attention please. The train is now approaching ${station.name} station. Passengers are requested to stand back from the platform edge.`;
        this._speak(eng, 'en-IN', 0.88, 0.95);

        // 3. Hindi
        const hin = `यात्रीगण कृपया ध्यान दें। गाड़ी अब ${station.hindi || station.name} स्टेशन पर पहुंच रही है।`;
        this._speak(hin, 'hi-IN', 0.92, 0.95);
    }

    /** Arrival announcements (Malayalam -> English -> Hindi) */
    announceArrival(station, platformNo = 1) {
        if (station.name === this._lastStation && this._lastState === 'arrival') return;
        this._lastStation = station.name;
        this._lastState   = 'arrival';

        // 1. Malayalam
        const mal = `${station.name} platform number ${platformNo}il ethicharnnu. Shradhikkuka.`;
        this._speak(mal, 'en-IN', 0.85, 0.95, true);

        // 2. English
        const eng = `${station.name} station. This train has arrived at platform number ${platformNo}. Passengers alighting here may do so.`;
        this._speak(eng, 'en-IN', 0.88, 0.95);

        // 3. Hindi
        const hin = `${station.hindi || station.name} स्टेशन। गाड़ी प्लेटफार्म नंबर ${platformNo} पर आ चुकी है।`;
        this._speak(hin, 'hi-IN', 0.92, 0.95);
    }

    /** Departure announcements (Malayalam -> English -> Hindi) */
    announceDeparture(station, nextStation) {
        if (this._lastState === 'departure' && this._lastStation === station.name) return;
        this._lastState   = 'departure';
        this._lastStation = station.name;

        // 1. Malayalam
        let mal = `${station.name} ninnu vandi purappedaanaayi thayyaaraayirikkunnu.`;
        if (nextStation) mal += ` Adutha stop: ${nextStation.name}.`;
        this._speak(mal, 'en-IN', 0.85, 0.95, true);

        // 2. English
        let eng = `Attention please. The train is ready to depart from ${station.name}.`;
        if (nextStation) eng += ` Next stop: ${nextStation.name}.`;
        eng += ` Passengers are requested to board immediately.`;
        this._speak(eng, 'en-IN', 0.88, 0.95);

        // 3. Hindi
        let hin = `यात्रीगण कृपया ध्यान दें। गाड़ी ${station.hindi || station.name} से प्रस्थान करने के लिए तैयार है।`;
        if (nextStation) hin += ` अगला स्टेशन: ${nextStation.hindi || nextStation.name}।`;
        hin += ` यात्रियों से अनुरोध है कि वे तुरंत सवार हों।`;
        this._speak(hin, 'hi-IN', 0.92, 0.95);
    }

    /** Terminus destination reached */
    announceTerminus(station) {
        this._lastState   = 'terminus';
        this._lastStation = station.name;

        // 1. Malayalam
        const mal = `Attention please. Ee vandi avasanam ethicherendathaya ${station.name}il ethicherunnirikkunnu. Ellavarum eranguka. Southern Railway-ude nandi.`;
        this._speak(mal, 'en-IN', 0.85, 0.95, true);

        // 2. English
        const eng = `Attention please. This train has arrived at its final destination, ${station.name}. Southern Railway thanks you for travelling with us. Have a pleasant journey ahead.`;
        this._speak(eng, 'en-IN', 0.88, 0.95);

        // 3. Hindi
        const hin = `यात्रीगण कृपया ध्यान दें। यह गाड़ी अपने अंतिम स्टेशन, ${station.hindi || station.name} पर पहुंच चुकी है। यात्रा के लिए धन्यवाद।`;
        this._speak(hin, 'hi-IN', 0.92, 0.95);
    }

    update(stationMgr, physics, getStationsFunc) {
        if (!this.enabled) return;

        const state   = stationMgr?.state;
        const station = stationMgr?.currentStation;
        if (!station) return;

        const stations = getStationsFunc();
        const currentIdx = stations.findIndex(s => s.name === station.name);
        const nextStation = currentIdx >= 0 ? stations[currentIdx + 1] : null;

        switch (state) {
            case 'APPROACHING':
                if (station.isStoppage) {
                    this.announceApproach(station);
                }
                break;
            case 'STOPPED':
                if (station.isStoppage) {
                    this.announceArrival(station);
                }
                if (station.isTerminus) {
                    setTimeout(() => this.announceTerminus(station), 4000);
                }
                break;
            case 'DEPARTING':
                if (station.isStoppage) {
                    this.announceDeparture(station, nextStation);
                }
                break;
        }
    }

    setEnabled(val) {
        this.enabled = val && 'speechSynthesis' in window;
        if (!val) window.speechSynthesis?.cancel();
    }

    destroy() {
        if (this.enabled) window.speechSynthesis?.cancel();
    }
}
