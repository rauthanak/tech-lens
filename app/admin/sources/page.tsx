import PageHeader from "@/components/PageHeader";
import SourceBrowser from "@/components/SourceBrowser";

export default function AdminSourcesPage() {
  return (
    <div>
      <PageHeader eyebrow="Sources" title="Source register">
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Every source the radar watches, categorized by discovery horizon.
        </p>
      </PageHeader>
      <SourceBrowser />
    </div>
  );
}
