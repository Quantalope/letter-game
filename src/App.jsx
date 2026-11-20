import { useState, useEffect, useRef } from "react";

// Put in track
const TRACK_URL = "/audio/test_audio.wav";

// Order and interval of letters
const LETTER_STRING =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ";
const START_OFFSET_S = 0.25;
const INTERVAL_S = 0.75; // time between letter starts

const CUES = [...LETTER_STRING.toUpperCase()].map((letter, i) => ({
  time: START_OFFSET_S + i * INTERVAL_S,
  letter,
}));

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

  // Create and preload audio
  useEffect(() => {
    const audio = new Audio(TRACK_URL);
    audio.preload = "auto";
    audioRef.current = audio;
    return () => audio.pause();
  }, []);

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
      for (let i = CUES.length - 1; i >= 0; i--) {
        if (CUES[i].time <= t) {
          idx = i;
          break;
        }
      }

      if (idx !== active) {
        closeWindow();
        active = idx;
        if (idx >= 0) {
          current.current = { letter: CUES[idx].letter, answered: false };
          setRound(idx + 1);
        }
      } else if (active >= 0 && t > CUES[active].time + WINDOW_S) {
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
  }, [phase]);

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

      {phase === "idle" && <button onClick={start}>Start</button>}

      {phase === "countdown" && (
        <h2 style={{ fontSize: 72 }}>{count || "Go"}</h2>
      )}

      {phase === "playing" && (
        <>
          <p>
            Letter {round} of {CUES.length}. Type what you hear.
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
            {hits} / {CUES.length} correct
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
