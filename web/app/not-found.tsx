import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <div className="auth">
          <div className="auth-box">
            <h1>Page not found</h1>
            <p className="sub">That address doesn&apos;t exist on TypeWit. It may have moved, or the link may be mistyped.</p>
            <div className="auth-form">
              <Link className="btn btn-primary btn-lg btn-block" href="/app/">Go to your dashboard</Link>
              <Link className="btn btn-lg btn-block" href="/">TypeWit home</Link>
              <p className="small muted center">Still stuck? <Link href="/support/">Get help</Link></p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
