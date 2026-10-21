import ListCounts from "@/components/ListCounts";
import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";

export default function AvailabilityPage() {
  return (
    <div>
      <PageHeader title="Commercial availability"
        intro="How available a technology is to buy today. Classify and assessments file each technology under one of these."
        help={<>
          <li>Tata&apos;s own values: Research, Pilot, Early commercial and Mature, plus Unclassified when the pages
            don&apos;t show it. &ldquo;Counts as emerging&rdquo; decides what the Emerging views on Technologies hold.</li>
          <li>The model picks the most advanced value its pages show with a dated, named example; a person can move
            any technology, and that choice wins.</li>
          <li>Click a value to edit it. Edits cost no model calls; see the note under the form for what each does.</li>
        </>} />
      <ListCounts list="availability" />
      <div className="mt-4">
        <ListItems list="availability" noun="a value" technologies={false} fields={[
          { key: "name", label: "Name" },
          { key: "definition", label: "Definition", kind: "long", note: "What the model reads: say what a technology must show to be here." },
          { key: "order", label: "Order", kind: "number" },
          { key: "emerging", label: "Counts as emerging", kind: "check" },
        ]} />
      </div>
    </div>
  );
}
