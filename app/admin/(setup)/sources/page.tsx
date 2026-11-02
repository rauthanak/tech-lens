import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SourceBrowser from "@/components/SourceBrowser";

export default function AdminSourcesPage() {
  return (
    <div>
      <PageHeader title="Sources"
        intro="Every source the radar watches, and how each one is read."
        right={<Link href="/admin/sources/new"
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-strong">Add source</Link>}
        help={<>
          <li>Sources are grouped by discovery horizon: H1 already on the market, H2 money moving before the market
            (early signs), and H3 not yet visible to the market (research and blind spots).</li>
          <li>How it&apos;s read: a website is crawled page by page; a data source (patents, papers, grants, filings,
            job boards) answers its saved searches; Not collected means its terms or access rules rule out collecting
            it.</li>
          <li>Only switched-on sources are collected, so the list opens on them; Show all, or the All filter, lists
            the rest too. Paid sources need a subscription and are skipped unless paid sources are allowed in the
            server&apos;s settings.</li>
          <li>Sort by clicking a column header, narrow the list with the filters, and click a source to edit it.
            Edits cost no model calls and apply from the next collection. A source with its own page budget says so
            under its status; the others use the default in Settings.</li>
          <li>Add source adds a website or a data source. It&apos;s live at once and shows on Changes, where Keep as
            defaults saves it into the seeding data. A source can be switched off, never deleted, so its pages keep
            their source.</li>
          <li>&ldquo;Not finished&rdquo; marks a data source with results still to collect; the next collection carries
            on where it stopped.</li>
        </>} />
      <SourceBrowser />
    </div>
  );
}
