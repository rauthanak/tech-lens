import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";

export default function AssumptionsPage() {
  return (
    <div>
      <PageHeader title="Assumptions"
        intro="The assumptions the radar's placements rest on, each dated: there's no economic model, so they're stated instead. Leaders see them in the leaders' view as scenarios, not forecasts."
        help={<>
          <li>Each is one sentence and the day it was stated, such as &ldquo;AI infrastructure investment stays high
            through FY27&rdquo;. The leaders&apos; view shows each with &ldquo;Scenario, not forecast&rdquo;.</li>
          <li>Publishing an edition (on the Briefing) freezes the list as it stands: an edit here shows in the leaders&apos; view from
            the next edition, and leaders keep seeing the earlier list until then.</li>
          <li>Order sets where it appears, lowest first. Click an assumption to edit or remove it. Edits cost no model
            calls and change no score.</li>
        </>} />
      <div className="mt-6">
        <ListItems list="assumptions" noun="an assumption" technologies={false}
          removeNote="The leaders' view stops showing it from the next edition."
          note="It changes no score. The leaders' view shows the change from the next edition."
          fields={[
            { key: "name", label: "Statement", kind: "long", note: "One sentence, up to 200 characters." },
            { key: "date", label: "Stated on", kind: "date" },
            { key: "order", label: "Order", kind: "number" },
          ]} />
      </div>
    </div>
  );
}
