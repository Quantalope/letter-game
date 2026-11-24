import { useState, useEffect, useRef, useMemo } from "react";

const BASE = import.meta.env.BASE_URL;

const TRACKS = [
  {
    name: "practice",
    url: `${BASE}audio/practice.wav`,
  },
  {
    name: "1D",
    url: `${BASE}audio/1D.wav`,
  },
  {
    name: "2A",
    url: `${BASE}audio/2A.wav`,
  },
  {
    name: "3B",
    url: `${BASE}audio/13B.wav`,
  },
  {
    name: "4C",
    url: `${BASE}audio/4C.wav`,
  },
  {
    name: "5N",
    url: `${BASE}audio/5N.wav`,
  },
  {
    name: "6G",
    url: `${BASE}audio/6G.wav`,
  },
  {
    name: "7L",
    url: `${BASE}audio/7L.wav`,
  },
  {
    name: "8M",
    url: `${BASE}audio/8M.wav`,
  },
  {
    name: "9N",
    url: `${BASE}audio/9N.wav`,
  },
  {
    name: "10N",
    url: `${BASE}audio/10N.wav`,
  },
  {
    name: "11S",
    url: `${BASE}audio/11S.wav`,
  },
  {
    name: "12A",
    url: `${BASE}audio/12A.wav`,
  },
  {
    name: "13A",
    url: `${BASE}audio/13A.wav`,
  },
  {
    name: "14A",
    url: `${BASE}audio/14A.wav`,
  },
  {
    name: "15D",
    url: `${BASE}audio/15D.wav`,
  },
  {
    name: "16A",
    url: `${BASE}audio/16A.wav`,
  },
  {
    name: "17N",
    url: `${BASE}audio/17N.wav`,
  },
  {
    name: "18M",
    url: `${BASE}audio/18M.wav`,
  },
  {
    name: "19L",
    url: `${BASE}audio/19L.wav`,
  },
];

const buildCues = () =>
  [...LETTER_STRING.toUpperCase()].map((letter, i) => ({
    time: START_OFFSET_S + i * INTERVAL_S,
    letter,
  }));
//
// Order and interval of letters
const LETTER_STRING =
  "UDAXIHHEXDVXRCSNBACGHQTARGWUWRNHOSIZAYZFWNKIEGYKDCMDLLTIZBXORDMCRJUTLSGWCBVHYJCHDMIOULFLLGVIWVUCTUFRXHFOMIUWRHVKYYBHBZKMICGSWKGUPMUOEIEHXRRIXSNSMLHEQPCYBDEUFZVN";
const START_OFFSET_S = 0.25;
const INTERVAL_S = 0.75; // time between letter starts

const WINDOW_S = 1; // max time to respond after a letter starts
const COUNTDOWN_FROM = 3;

const cell = { border: "1px solid #999", padding: "6px 14px" };

export default function App() {
  const [phase, setPhase] = useState("idle"); // idle | countdown | playing | done
  const [count, setCount] = useState(COUNTDOWN_FROM);
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState("");

  const audioRef = useRef(null);
  const current = useRef({ letter: null, answered: false });

  const [trackIdx, setTrackIdx] = useState(0);
  const cues = useMemo(() => buildCues(TRACKS[trackIdx]), [trackIdx]);

  // Create and preload audio
  useEffect(() => {
    const audio = new Audio(TRACKS[trackIdx].url);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => audio.pause();
  }, [trackIdx]);

  const start = () => {
    setCount(COUNTDOWN_FROM);
    setRound(0);
    setHits(0);
    setMisses(0);
    setFeedback("");
    current.current = { letter: null, answered: false };
    setPhase("countdown");
    setResults([]);
  };

  const [results, setResults] = useState([]);
  const typedString = results.map((r) => r.typed ?? "-").join(", ");
  const label = (r) =>
    r.typed === null ? "Missed" : r.typed === r.letter ? "Hit" : "Wrong";
  const resultsText = results.map((r) => label(r)).join(", ");

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count]);

  // Play the track and follow its playback position
  useEffect(() => {
    if (phase !== "playing") return;
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play().catch((err) => console.error("Audio failed:", err));

    let raf;
    let active = -1; // index of open cue

    // Close current window
    const closeWindow = () => {
      const c = current.current;
      if (c.letter && !c.answered) {
        setMisses((m) => m + 1);
        setResults((r) => [...r, { letter: c.letter, typed: null }]);
      }
      setFeedback("Waiting...");
      current.current = { letter: null, answered: false };
    };

    const tick = () => {
      const t = audio.currentTime;

      // Latest cue that has started
      let idx = -1;
      for (let i = cues.length - 1; i >= 0; i--) {
        if (cues[i].time <= t) {
          idx = i;
          break;
        }
      }

      if (idx !== active) {
        closeWindow();
        active = idx;
        if (idx >= 0) {
          current.current = { letter: cues[idx].letter, answered: false };
          setRound(idx + 1);
        }
      } else if (active >= 0 && t > cues[active].time + WINDOW_S) {
        closeWindow();
      }

      raf = requestAnimationFrame(tick);
    };

    const onEnded = () => {
      closeWindow();
      setPhase("done");
    };

    audio.addEventListener("ended", onEnded);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [phase, cues]);

  // Keyboard input
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e) => {
      if (e.key.length !== 1) return;
      const c = current.current;
      if (!c.letter || c.answered) return;
      c.answered = true;
      setResults((r) => [
        ...r,
        { letter: c.letter, typed: e.key.toUpperCase() },
      ]);
      if (e.key.toUpperCase() === c.letter) {
        setHits((h) => h + 1);
        setFeedback("Correct");
      } else {
        setMisses((m) => m + 1);
        setFeedback(`Wrong (it was ${c.letter})`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  return (
    <div
      style={{ fontFamily: "sans-serif", textAlign: "center", marginTop: 80 }}
    >
      <h1>Letter Typing Test</h1>

      {phase === "idle" && (
        <>
          <select
            value={trackIdx}
            onChange={(e) => setTrackIdx(Number(e.target.value))}
          >
            {TRACKS.map((t, i) => (
              <option key={i} value={i}>
                {t.name}
              </option>
            ))}
          </select>
          <button onClick={start}>Start</button>
        </>
      )}

      {phase === "countdown" && (
        <h2 style={{ fontSize: 72 }}>{count || "Go"}</h2>
      )}

      {phase === "playing" && (
        <>
          <p>
            Letter {round} of {cues.length}. Type what you hear.
          </p>
          <p style={{ height: 24 }}>{feedback}</p>
          <p>
            Hits: {hits} | Misses: {misses}
          </p>
        </>
      )}

      {phase === "done" && (
        <>
          <h2>
            {hits} / {cues.length} correct
          </h2>
          <table style={{ margin: "0 auto 24px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cell}>#</th>
                <th style={cell}>Letter</th>
                <th style={cell}>You typed</th>
                <th style={cell}>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td style={cell}>{i + 1}</td>
                  <td style={cell}>{r.letter}</td>
                  <td style={cell}>{r.typed ?? "-"}</td>
                  <td style={cell}>
                    {r.typed === null
                      ? "Missed"
                      : r.typed === r.letter
                        ? "Hit"
                        : "Wrong"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            style={{ margin: "0px 10px 0px 0px" }}
            onClick={() => navigator.clipboard.writeText(typedString)}
          >
            Copy Typed List
          </button>
          <button
            style={{ margin: "0px 10px 0px 0px" }}
            onClick={() => navigator.clipboard.writeText(resultsText)}
          >
            Copy Hit/Miss List
          </button>
          <button onClick={start}>Play again</button>
        </>
      )}
    </div>
  );
}
