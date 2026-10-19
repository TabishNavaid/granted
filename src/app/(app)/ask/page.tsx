import type { Metadata } from "next";
import { AskView } from "./ask-view";

export const metadata: Metadata = { title: "Ask" };

const STARTERS = [
  "What is due in the next two weeks?",
  "How much have we won this year?",
  "Which matches should I look at first?",
  "What is waiting for me today?",
];

export default function AskPage() {
  return <AskView starters={STARTERS} />;
}
