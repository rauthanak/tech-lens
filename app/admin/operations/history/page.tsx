"use client";

import { Suspense } from "react";
import OperationsHistory from "@/components/OperationsHistory";
import OperationsTabs from "@/components/OperationsTabs";
import PageHeader from "@/components/PageHeader";
import TechnicalDetailsSwitch from "@/components/TechnicalDetailsSwitch";

/** Operations › History: every run that used the model, newest first. */
export default function HistoryPage() {
  return (
    <div>
      <OperationsTabs />
      <PageHeader title="History" right={<TechnicalDetailsSwitch />}
        intro="Every run that used the model, newest first, with what it used."
        help={<>
          <li>Collections (with the organizing that ended them), Classify, assessment runs, Points of View, Find
            evidence, import matching and checks of stored pages.</li>
          <li>Each shows its tokens: in (everything sent), how many of those were reused at a fraction of the price,
            and out (what the model wrote). Cost by skill opens the breakdown; a row with a page opens it. Runs from
            before tokens were recorded say so.</li>
          <li>50 runs a page; leaving and coming back keeps your place.</li>
          <li>The Technical details switch adds each run&apos;s id.</li>
        </>} />
      <Suspense fallback={null}><OperationsHistory /></Suspense>
    </div>
  );
}
