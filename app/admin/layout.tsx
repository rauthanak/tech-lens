import NextStep from "@/components/NextStep";
import TopBar from "@/components/TopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <NextStep />
      <main className="mx-auto max-w-[1760px] px-6 py-8 lg:px-10">{children}</main>
    </>
  );
}
