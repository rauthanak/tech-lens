import ListCounts from "@/components/ListCounts";
import ListItems from "@/components/ListItems";
import PageHeader from "@/components/PageHeader";

export default function TrlPage() {
  return (
    <div>
      <PageHeader title="TRL levels"
        intro="Technology readiness, 1 to 9, in the words the model and every screen use."
        help={<>
          <li>The scale is fixed at nine levels; their names and definitions can be edited.</li>
          <li>The model judges a level only from dated evidence of demonstrations, trials, deployments or ratified
            standards, and says what&apos;s missing when the pages can&apos;t support one.</li>
          <li>Its Maturity score should agree with its level: the Before publishing list flags any that don&apos;t.</li>
        </>} />
      <ListCounts list="trl_levels" />
      <div className="mt-4">
        <ListItems list="trl_levels" noun="a level" canAdd={false} canRemove={false} technologies={false} fields={[
          { key: "name", label: "Name" },
          { key: "definition", label: "Definition", kind: "long" },
        ]} />
      </div>
    </div>
  );
}
