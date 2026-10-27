import type { AskState } from "@/app/_session/thread";

const NOTE: Partial<Record<AskState, string>> = { "answered-in-terminal": "Answered in the terminal", cancelled: "No longer needed" };

export function AskTurn({ questions, state }: { questions: string[]; state: AskState }) {
  const note = NOTE[state];
  return (
    <div className={`turn bot ask-${state}`}>
      {questions.length === 1 ? <p>{questions[0]}</p> : <ol className="asks">{questions.map((q) => <li key={q}>{q}</li>)}</ol>}
      {note ? <p className="sub">{note}</p> : null}
    </div>
  );
}
