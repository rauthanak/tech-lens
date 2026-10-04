import PageHeader from "@/components/PageHeader";
import SourceBrowser from "@/components/SourceBrowser";

export default function AdminSourcesPage() {
  return (
    <div>
      <PageHeader title="Sources"
        intro="Every source the radar watches, and how each one is read."
        help={<>
          <li>Sources are grouped by discovery horizon: H1 known knowns (the market already has it), H2 known
            unknowns (money is moving ahead of the market) and H3 unknown unknowns (not yet visible to the
            market).</li>
          <li>How it&apos;s read: a website is crawled page by page; a data source (patents, papers, grants, filings,
            job boards) answers its saved searches; Never means its terms or access rule collecting out.</li>
          <li>Only switched-on sources are collected. Licensed sources need a subscription and are skipped unless
            paid sources are allowed in the server&apos;s settings.</li>
          <li>Sort by clicking a column header, narrow the list with the filters, and click a source to edit it.
            Edits cost no model calls and apply from the next collection.</li>
          <li>◐ Didn&apos;t finish marks a data source with results still to collect; the next collection carries on
            where it stopped.</li>
        </>} />
      <SourceBrowser />
    </div>
  );
}
