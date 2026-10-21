import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import SetAsideList from "@/components/SetAsideList";
import SignalListEditor from "@/components/SignalListEditor";
import SignalSuggestions from "@/components/SignalSuggestions";

const SUMMARY = "cursor-pointer text-sm font-medium text-link hover:underline";

export default function SignalListPage() {
  return (
    <div>
      <PageHeader title="Signal list"
        intro="What the radar looks for on every page it collects, and what it sets aside."
        help={<>
          <li>Never miss: developments the radar always reports when a page states them, like a funding round or a
            product launch. They become findings on the Briefing, in this order; reorder them with ▲▼ at no model
            cost.</li>
          <li>Can ignore: kinds of page with nothing worth keeping, like a single job ad. A page that is only that
            is set aside: kept, but not used for technologies or assessments.</li>
          <li>Each row counts how often it was found, all time and in the latest collection. The switch pauses a
            row without deleting it.</li>
          <li>Adding, editing, switching or deleting a row applies from the next collection and marks stored pages
            as not yet checked; Check again on Operations re-reads them, at about one model call per page.
            Reordering changes nothing.</li>
          <li>Below the list, two sections stay closed until opened: events from the last 30 days that fit no signal
            on the list, grouped by the name the model gave them (if one keeps coming back, add it to the list); and
            the pages a Can ignore rule set aside.</li>
        </>} />
      <Suspense>
        <SignalListEditor />
      </Suspense>
      {/* long lists of cards, so each stays closed until asked for */}
      <details className="mt-10">
        <summary className={SUMMARY}>Show the events that fit no signal on the list (last 30 days)</summary>
        <SignalSuggestions />
      </details>
      <details className="mt-6">
        <summary className={SUMMARY}>Show the pages set aside by a Can ignore rule (last 30 days)</summary>
        <SetAsideList />
      </details>
    </div>
  );
}
