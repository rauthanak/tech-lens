import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";

export default function MechanismsPage() {
  return (
    <div>
      <PageHeader title="Mechanisms"
        intro="The four ways a technology can make or save money for Tata. Every lever in a use case names one, so a reader sees at a glance whether it earns new revenue, keeps revenue Tata already has, cuts the cost of delivering, or needs less capital."
        help={<>
          <li>The names show beside every lever in a technology&apos;s use cases. The definitions are sent to the model
            with each fabric&apos;s levers, so editing one changes how the next assessment writes its use cases.</li>
          <li>Which mechanism each fabric&apos;s two levers use is set in Setup › Scoring method › Fabrics.</li>
          <li>Click a mechanism to edit its words. Edits cost no model calls; an addition applies from the next assessment.</li>
          <li>The four mechanisms and their definitions come from Nick&apos;s value note.</li>
        </>} />
      <div className="mt-6">
        <ListItems list="mechanisms" noun="a mechanism" canRemove={false} technologies={false}
          note="A new name shows at once in every use case; a changed definition is used from the next assessment, and an added mechanism can be picked from then on."
          fields={[
            { key: "name", label: "Name" },
            { key: "definition", label: "Definition: what counts as value this way", kind: "long" },
          ]} />
      </div>
    </div>
  );
}
