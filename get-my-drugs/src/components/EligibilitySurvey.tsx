import { useEffect, useRef, useState } from "react";
import {
  nextQuestionIndex,
  scoreAnswers,
  type Answers,
  type Question,
  type Survey,
  type Verdict,
} from "../eligibility/survey";

type Props = {
  survey: Survey;
  onFinish: (verdicts: Verdict[]) => void;
  /** Re-run the estimate with a suggested alternative drug */
  onTryAlternative: (rxcui: string) => void;
  canPrice: (rxcui: string) => boolean;
};

export function EligibilitySurvey({ survey, onFinish, onTryAlternative, canPrice }: Props) {
  const [history, setHistory] = useState(() => [nextQuestionIndex(survey, {}, -1)]);
  const [answers, setAnswers] = useState<Answers>({});
  const [failed, setFailed] = useState<Verdict>();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const current = history[history.length - 1];
  const q = survey.questions[current];
  const asked = history.map((i) => survey.questions[i].id);

  // Rough progress: questions asked so far vs. those still likely to be asked.
  let remaining = 0;
  for (let i = nextQuestionIndex(survey, answers, current); i !== -1; i = nextQuestionIndex(survey, answers, i)) remaining++;
  const progress = Math.round((history.length / (history.length + remaining)) * 100);

  function answer(value: string | string[]) {
    // Drop answers to later questions so a changed answer can't leave stale ones behind.
    const next: Answers = { [q.id]: value };
    survey.questions.slice(0, current).forEach((sq) => (next[sq.id] = answers[sq.id]));
    setAnswers(next);

    const verdict = q.score?.(next);
    if (verdict?.status === "not_met") {
      setFailed(verdict);
      return;
    }
    const n = nextQuestionIndex(survey, next, current);
    if (n === -1) onFinish(scoreAnswers(survey, next, asked));
    else setHistory([...history, n]);
  }

  function back() {
    if (failed) setFailed(undefined);
    else if (history.length > 1) setHistory(history.slice(0, -1));
  }

  return (
    <section className="card survey" ref={ref} aria-live="polite">
      <header className="survey-head">
        <div>
          <h2>Do you qualify for {survey.drugName}?</h2>
          <p className="hint">Based on {survey.policy}</p>
        </div>
        {(history.length > 1 || failed) && (
          <button type="button" className="link" onClick={back}>
            ← Back
          </button>
        )}
      </header>
      <div className="progress" role="progressbar" aria-valuenow={failed ? 100 : progress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${failed ? 100 : progress}%` }} />
      </div>

      {failed ? (
        <FailedStep
          drugName={survey.drugName}
          verdict={failed}
          canPrice={canPrice}
          onTryAlternative={onTryAlternative}
          onChangeAnswer={back}
          onContinue={() => onFinish(scoreAnswers(survey, answers, asked))}
        />
      ) : (
        <QuestionStep key={q.id} question={q} answers={answers} onAnswer={answer} />
      )}
    </section>
  );
}

function QuestionStep({
  question: q,
  answers,
  onAnswer,
}: {
  question: Question;
  answers: Answers;
  onAnswer: (value: string | string[]) => void;
}) {
  const prev = answers[q.id];
  const [selected, setSelected] = useState<string[]>(Array.isArray(prev) ? prev : []);
  const help = typeof q.help === "function" ? q.help(answers) : q.help;

  function toggle(value: string) {
    if (value === "none") return setSelected(selected.includes("none") ? [] : ["none"]);
    const rest = selected.filter((v) => v !== "none");
    setSelected(rest.includes(value) ? rest.filter((v) => v !== value) : [...rest, value]);
  }

  return (
    <fieldset className="question">
      <legend>{q.prompt}</legend>
      {help && <p className="hint">{help}</p>}
      <div className="answers">
        {q.options.map((o) => {
          const active = q.multi ? selected.includes(o.value) : prev === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className={`answer ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => (q.multi ? toggle(o.value) : onAnswer(o.value))}
            >
              {q.multi && <span className="check" aria-hidden>{active ? "✓" : ""}</span>}
              <span>
                {o.label}
                {o.hint && <small>{o.hint}</small>}
              </span>
            </button>
          );
        })}
      </div>
      {q.multi && (
        <button type="button" className="primary" disabled={selected.length === 0} onClick={() => onAnswer(selected)}>
          Continue
        </button>
      )}
    </fieldset>
  );
}

function FailedStep({
  drugName,
  verdict,
  canPrice,
  onTryAlternative,
  onChangeAnswer,
  onContinue,
}: {
  drugName: string;
  verdict: Verdict;
  canPrice: (rxcui: string) => boolean;
  onTryAlternative: (rxcui: string) => void;
  onChangeAnswer: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="failed">
      <div className="failed-reason">
        <strong>Your plan may not cover {drugName} yet</strong>
        <p>{verdict.reason}</p>
      </div>
      <h3 className="subhead">What you can do instead</h3>
      <ul className="alternatives">
        {verdict.alternatives?.map((alt) => (
          <li key={alt.title}>
            <span>
              {alt.title}
              <small>{alt.detail}</small>
            </span>
            {alt.rxcui && canPrice(alt.rxcui) && (
              <button type="button" className="chip" onClick={() => onTryAlternative(alt.rxcui!)}>
                See price
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="survey-actions">
        <button type="button" className="chip" onClick={onChangeAnswer}>
          Change my answer
        </button>
        <button type="button" className="primary" onClick={onContinue}>
          See prices anyway
        </button>
      </div>
    </div>
  );
}

const STATUS_ICON = { met: "✓", confirm: "?", not_met: "✕" } as const;

export function EligibilitySummary({ verdicts, onRetake }: { verdicts: Verdict[]; onRetake: () => void }) {
  const notMet = verdicts.some((v) => v.status === "not_met");
  const toConfirm = verdicts.some((v) => v.status === "confirm");
  const [title, tone] = notMet
    ? ["Not likely to be approved yet", "bad"]
    : toConfirm
      ? ["Likely to qualify. Confirm a few items with your prescriber", "warn"]
      : ["You likely meet your plan's criteria", "good"];

  return (
    <section className="card eligibility">
      <header className="survey-head">
        <h2>
          <span className={`badge ${tone}`}>{title}</span>
        </h2>
        <button type="button" className="link" onClick={onRetake}>
          Retake
        </button>
      </header>
      <ul className="checklist">
        {verdicts.map((v) => (
          <li key={v.label} className={v.status}>
            <span className="icon" aria-hidden>{STATUS_ICON[v.status]}</span>
            <span>
              {v.label}
              {v.status === "confirm" && <small>Confirm with your prescriber</small>}
              {v.status === "not_met" && v.reason && <small>{v.reason}</small>}
            </span>
          </li>
        ))}
      </ul>
      <p className="disclaimer">
        Bring this checklist to your prescriber. They submit the prior authorization, and your plan makes the final decision.
      </p>
    </section>
  );
}
